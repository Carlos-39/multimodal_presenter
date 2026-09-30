"""Dry run del Hito 7: 4 condiciones × 1 documento × 6 preguntas + juez Haiku.

Objetivo: validar el pipeline de punta a punta y medir el COSTO REAL (no estimado) para decidir
si escalar. Registra cada corrida en JSONL (trazable) y proyecta el costo de la versión reducida
y la completa. Uso:  uv run --group experiments python -m experiments.run_dryrun
"""

from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path

from .common import (
    DATA_DIR,
    HAIKU,
    RUNS_DIR,
    RunRecord,
    Usage,
    append_jsonl,
    lib_versions,
    page_count,
    subset_pdf,
)
from .dataset import DOC_ID, QUESTIONS
from .generate import generate_answer
from .graph_rag import GraphRAGIndex
from .judge import judge_answer
from .transcription import transcribe_pages
from .vector_rag import VoyagePageIndex

K = 5  # presupuesto de páginas por consulta (condiciones con recuperación)
VOYAGE_USD_PER_1M = 0.12


def _voyage_usd(tokens: int) -> float:
    return round(tokens * VOYAGE_USD_PER_1M / 1_000_000, 6)


def _recall(retrieved: list[int], evidence: list[int]) -> float | None:
    if not evidence:  # unanswerable → recall no aplica
        return None
    hit = len(set(retrieved) & set(evidence))
    return round(hit / len(evidence), 3)


async def main() -> None:
    pdf = (DATA_DIR / "documents" / "doc_dryrun.pdf").read_bytes()
    n_pages = page_count(pdf)
    all_pages = list(range(1, n_pages + 1))
    run_log = RUNS_DIR / "dryrun.jsonl"
    if run_log.exists():
        run_log.unlink()
    print(f"Documento: {DOC_ID} ({n_pages} páginas) · {len(QUESTIONS)} preguntas · k={K}")

    # ── Indexación (una vez por documento) ──
    print("Indexando… (transcripción Haiku + grafo LightRAG + embeddings Voyage)")
    t0 = time.monotonic()

    # Transcripción cacheada en disco para no re-pagar Haiku en re-runs.
    trans_cache = DATA_DIR / "indices" / f"transcription_{DOC_ID}.json"
    if trans_cache.exists():
        cached = json.loads(trans_cache.read_text(encoding="utf-8"))
        transcription = cached["transcription"]
        per_page = {int(k): v for k, v in cached["per_page"].items()}
        trans_usage = Usage(model=HAIKU)  # cacheada: sin costo nuevo
        print("  transcripción: cacheada (sin costo nuevo)")
    else:
        transcription, per_page, trans_usage = await transcribe_pages(pdf)
        trans_cache.parent.mkdir(parents=True, exist_ok=True)
        trans_cache.write_text(
            json.dumps({"transcription": transcription, "per_page": per_page}, ensure_ascii=False),
            encoding="utf-8",
        )

    graph = GraphRAGIndex(working_dir=str(DATA_DIR / "indices" / "graph" / DOC_ID))
    await graph.build(transcription, per_page)

    # Voyage multimodal (condición 2): el tier gratis SIN tarjeta limita a 3 RPM / 10K TPM, lo que
    # bloquea los embeddings de imágenes de página. Se reporta como hallazgo y se continúa con las
    # otras 3 condiciones si falla.
    vector = VoyagePageIndex()
    vector_available = True
    try:
        await vector.index(pdf)
    except Exception as exc:  # noqa: BLE001 — HALLAZGO, no se oculta
        vector_available = False
        print(
            f"  [BLOQUEADO] Voyage multimodal (vector_rag): {type(exc).__name__}: {str(exc)[:160]}"
        )

    index_seconds = round(time.monotonic() - t0, 1)
    voyage_tokens = (vector.index_tokens if vector_available else 0) + graph.embed_tokens
    index_usd = trans_usage.usd + graph.llm_usage.usd + _voyage_usd(voyage_tokens)
    print(
        f"  indexación: {index_seconds}s · transcripción ${round(trans_usage.usd, 4)} · "
        f"grafo(Haiku) ${round(graph.llm_usage.usd, 4)} · voyage ${_voyage_usd(voyage_tokens)} "
        f"→ total ${round(index_usd, 4)}"
    )

    # ── Consultas: condiciones disponibles × preguntas ──
    async def retrieve(condition: str, q) -> list[int]:
        if condition == "baseline":
            return all_pages
        if condition == "vector_rag":
            return await vector.retrieve(q.question, K)
        if condition == "lightrag_naive":
            return await graph.retrieve(q.question, "naive", K)
        if condition == "lightrag_graph":
            return await graph.retrieve(q.question, "hybrid", K)
        raise ValueError(condition)

    conditions = [
        "baseline",
        *(["vector_rag"] if vector_available else []),
        "lightrag_naive",
        "lightrag_graph",
    ]
    query_usd_total = 0.0
    judge_usd_total = 0.0
    agg: dict[str, dict] = {
        c: {"correct": [], "recall": [], "usd": 0.0, "errors": 0} for c in conditions
    }

    for q in QUESTIONS:
        for cond in conditions:
            t = time.monotonic()
            try:
                pages = await retrieve(cond, q)
                if cond == "baseline":
                    pages_pdf = pdf
                else:
                    pages_pdf = subset_pdf(pdf, pages or [1])  # evita PDF de 0 páginas
                answer, gen_usage = await generate_answer(pages_pdf, q.question)
                correctness, judge_usage = await judge_answer(
                    q.question, q.reference_answer, answer
                )
            except Exception as exc:  # noqa: BLE001 — un fallo es un HALLAZGO, se registra
                agg[cond]["errors"] += 1
                print(f"  [ERROR] {cond} / {q.id}: {type(exc).__name__}: {exc}")
                append_jsonl(
                    run_log,
                    {
                        "doc_id": DOC_ID,
                        "question_id": q.id,
                        "condition": cond,
                        "error": f"{type(exc).__name__}: {exc}",
                    },
                )
                continue

            latency = round(time.monotonic() - t, 2)
            query_usd_total += gen_usage.usd
            judge_usd_total += judge_usage.usd
            agg[cond]["usd"] += gen_usage.usd
            agg[cond]["correct"].append(correctness)
            r = _recall(pages, q.evidence_pages)
            if r is not None:
                agg[cond]["recall"].append(r)

            append_jsonl(
                run_log,
                RunRecord(
                    doc_id=DOC_ID,
                    question_id=q.id,
                    category=q.category,
                    condition=cond,
                    rep=1,
                    answer=answer,
                    retrieved_pages=pages,
                    evidence_pages=q.evidence_pages,
                    query_usd=gen_usage.usd,
                    latency_s=latency,
                    usage={
                        "input_tokens": gen_usage.input_tokens,
                        "output_tokens": gen_usage.output_tokens,
                        "cache_read_input_tokens": gen_usage.cache_read_input_tokens,
                        "cache_write_input_tokens": gen_usage.cache_write_input_tokens,
                        "correctness": correctness,
                    },
                ),
            )

    # ── Reporte ──
    def avg(xs: list[float]) -> float:
        return round(sum(xs) / len(xs), 3) if xs else 0.0

    print("\n=== CALIDAD Y COSTO POR CONDICIÓN ===")
    print(f"{'condición':16} {'correctness':>11} {'recall@k':>9} {'$consultas':>11} {'errores':>8}")
    for c in conditions:
        a = agg[c]
        print(
            f"{c:16} {avg(a['correct']):>11} {avg(a['recall']):>9} "
            f"{round(a['usd'], 4):>11} {a['errors']:>8}"
        )

    total = index_usd + query_usd_total + judge_usd_total
    print("\n=== COSTO REAL DEL DRY RUN (USD) ===")
    print(f"  indexación (1 doc): ${round(index_usd, 4)}")
    print(f"  consultas (Sonnet): ${round(query_usd_total, 4)}")
    print(f"  juez (Haiku):       ${round(judge_usd_total, 4)}")
    print(f"  TOTAL:              ${round(total, 4)}")

    # ── Proyecciones (extrapolación desde datos reales) ──
    n_runs = len(QUESTIONS) * len(conditions)
    per_run = (query_usd_total + judge_usd_total) / n_runs if n_runs else 0.0
    reduced = 3 * index_usd + (30 * 4 * 2) * per_run  # 3 docs, ~30 preg, ~2 reps (cota alta)
    full = 6 * index_usd + (55 * 4 * 3) * per_run  # 6 docs, ~55 preg, 3 reps (cota alta)
    print("\n=== PROYECCIÓN (cota alta) ===")
    print(f"  reducida (3 docs, ~30 preg, 2 reps): ~${round(reduced, 2)}")
    print(f"  completa (6 docs, ~55 preg, 3 reps): ~${round(full, 2)}")

    print("\nversiones:", lib_versions())
    print(f"JSONL: {run_log}")
    Path(RUNS_DIR / "dryrun_summary.txt").write_text(
        f"index_usd={index_usd}\nquery_usd={query_usd_total}\njudge_usd={judge_usd_total}\n"
        f"total={total}\nreduced~={reduced}\nfull~={full}\nversions={lib_versions()}\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    asyncio.run(main())
