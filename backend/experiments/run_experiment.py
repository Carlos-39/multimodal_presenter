"""Arnés del experimento reducido (Hito 7): 4 condiciones × 3 docs × preguntas validadas × 1 rep.

Fases (separadas para el mini-gate de costo):
  index   → indexa los 3 docs (transcripción + grafo + embeddings) y reporta el COSTO real.
  query   → corre las 4 condiciones sobre cada pregunta, registra JSONL trazable + juez.
  report  → agrega calidad por categoría×doc×condición, costo indexación/consulta y punto de
            equilibrio.

Uso:  uv run --group experiments python -m experiments.run_experiment index
      uv run --group experiments python -m experiments.run_experiment query
      uv run --group experiments python -m experiments.run_experiment report

Reutiliza artefactos en INDICES_DIR (fuera de OneDrive): transcripción, grafo, vectores Voyage y
el PDF comprimido del baseline. Así `query` no re-paga la indexación.
"""

from __future__ import annotations

import asyncio
import json
import sys
import time
from collections import defaultdict
from pathlib import Path

from .common import (
    DATA_DIR,
    HAIKU,
    INDICES_DIR,
    RUNS_DIR,
    RunRecord,
    Usage,
    append_jsonl,
    compress_pdf,
    lib_versions,
    page_count,
    subset_pdf,
)
from .generate import generate_answer
from .graph_rag import GraphRAGIndex
from .judge import apply_unanswerable_gate, judge_answer
from .transcription import transcribe_pages
from .vector_rag import VoyagePageIndex

K = 5  # presupuesto de páginas por consulta (condiciones con recuperación)
REPS = 1  # Carlos eligió 1 repetición (presupuesto); sin varianza (limitación declarada)
VOYAGE_USD_PER_1M = 0.12
CONDITIONS = ["baseline", "vector_rag", "lightrag_naive", "lightrag_graph"]
RUN_LOG = RUNS_DIR / "experiment.jsonl"
INDEX_SUMMARY = RUNS_DIR / "index_summary.json"


def _voyage_usd(tokens: int) -> float:
    return round(tokens * VOYAGE_USD_PER_1M / 1_000_000, 6)


def load_dataset() -> tuple[dict, list[dict]]:
    data = json.loads((DATA_DIR / "dataset.json").read_text(encoding="utf-8"))
    docs = {d["id"]: d for d in data["documents"]}
    return docs, data["questions"]


def _pdf_path(doc: dict) -> Path:
    return DATA_DIR / "documents" / doc["file"]


def _transcription_cache(doc_id: str) -> Path:
    return INDICES_DIR / f"transcription_{doc_id}.json"


# ─────────────────────────────────────────────────────────────
# FASE INDEX (mini-gate)
# ─────────────────────────────────────────────────────────────
async def index_phase() -> None:
    docs, _ = load_dataset()
    INDICES_DIR.mkdir(parents=True, exist_ok=True)
    summary = {"per_doc": {}, "versions": lib_versions()}
    grand_total = 0.0

    for doc_id, doc in docs.items():
        pdf = _pdf_path(doc).read_bytes()
        n = page_count(pdf)
        print(f"\n[{doc_id}] {n} páginas — indexando…")
        t0 = time.monotonic()

        # Transcripción (cacheada).
        cache = _transcription_cache(doc_id)
        if cache.exists():
            c = json.loads(cache.read_text(encoding="utf-8"))
            transcription = c["transcription"]
            per_page = {int(k): v for k, v in c["per_page"].items()}
            trans_usage = Usage(model=HAIKU)
            print("  transcripción: cacheada")
        else:
            transcription, per_page, trans_usage = await transcribe_pages(pdf)
            cache.write_text(
                json.dumps(
                    {"transcription": transcription, "per_page": per_page}, ensure_ascii=False
                ),
                encoding="utf-8",
            )

        # Grafo LightRAG (persistido en working_dir).
        graph = GraphRAGIndex(working_dir=str(INDICES_DIR / "graph" / doc_id))
        await graph.build(transcription, per_page)

        # Vectores Voyage multimodal por página (persistidos).
        vector = VoyagePageIndex()
        await vector.index(pdf)
        vector.save(INDICES_DIR / f"voyage_{doc_id}.npy")

        # PDF comprimido del baseline (si supera 32MB de Anthropic).
        baseline_pdf = compress_pdf(pdf, max_mb=30.0)
        (INDICES_DIR / f"baseline_{doc_id}.pdf").write_bytes(baseline_pdf)

        voyage_tokens = vector.index_tokens + graph.embed_tokens
        doc_usd = trans_usage.usd + graph.llm_usage.usd + _voyage_usd(voyage_tokens)
        grand_total += doc_usd
        secs = round(time.monotonic() - t0, 1)
        summary["per_doc"][doc_id] = {
            "pages": n,
            "transcription_usd": trans_usage.usd,
            "graph_haiku_usd": graph.llm_usage.usd,
            "voyage_tokens": voyage_tokens,
            "voyage_usd": _voyage_usd(voyage_tokens),
            "index_usd": round(doc_usd, 4),
            "baseline_pdf_mb": round(len(baseline_pdf) / 1024 / 1024, 1),
            "seconds": secs,
        }
        print(
            f"  transcripcion ${round(trans_usage.usd, 4)} · "
            f"grafo ${round(graph.llm_usage.usd, 4)} · "
            f"voyage ${_voyage_usd(voyage_tokens)} · total ${round(doc_usd, 4)} · {secs}s · "
            f"baseline {summary['per_doc'][doc_id]['baseline_pdf_mb']}MB"
        )

    summary["index_usd_total"] = round(grand_total, 4)
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    INDEX_SUMMARY.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n=== INDEXACIÓN TOTAL (3 docs): ${round(grand_total, 4)} ===")
    print(f"Resumen → {INDEX_SUMMARY}")


# ─────────────────────────────────────────────────────────────
# FASE QUERY
# ─────────────────────────────────────────────────────────────
def _recall(retrieved: list[int], evidence: list[int]) -> float | None:
    if not evidence:
        return None
    return round(len(set(retrieved) & set(evidence)) / len(evidence), 3)


async def _retrieve(
    condition: str, question: str, doc: dict, graph: GraphRAGIndex, vector: VoyagePageIndex
) -> list[int]:
    if condition == "baseline":
        return list(range(1, doc["pages"] + 1))
    if condition == "vector_rag":
        return await vector.retrieve(question, K)
    mode = "naive" if condition == "lightrag_naive" else "hybrid"
    return await graph.retrieve(question, mode, K)


async def query_phase() -> None:
    docs, questions = load_dataset()
    if RUN_LOG.exists():
        RUN_LOG.unlink()
    by_doc = defaultdict(list)
    for q in questions:
        by_doc[q["doc"]].append(q)

    for doc_id, doc in docs.items():
        pdf = _pdf_path(doc).read_bytes()
        c = json.loads(_transcription_cache(doc_id).read_text(encoding="utf-8"))
        per_page = {int(k): v for k, v in c["per_page"].items()}
        graph = GraphRAGIndex(working_dir=str(INDICES_DIR / "graph" / doc_id))
        await graph.load(per_page)
        vector = VoyagePageIndex()
        vector.load(INDICES_DIR / f"voyage_{doc_id}.npy")
        baseline_pdf = (INDICES_DIR / f"baseline_{doc_id}.pdf").read_bytes()
        print(f"\n[{doc_id}] {len(by_doc[doc_id])} preguntas × {len(CONDITIONS)} condiciones")

        for q in by_doc[doc_id]:
            for cond in CONDITIONS:
                for rep in range(REPS):
                    t = time.monotonic()
                    try:
                        pages = await _retrieve(cond, q["question"], doc, graph, vector)
                        pages_pdf = (
                            baseline_pdf if cond == "baseline" else subset_pdf(pdf, pages or [1])
                        )
                        answer, gen = await generate_answer(pages_pdf, q["question"])
                        correctness, judge = await judge_answer(
                            q["question"], q["reference_answer"], answer
                        )
                        # Gate post-auditoría: en `unanswerable`, abstenerse sin recuperar nada
                        # no puntúa como recuperar y verificar la ausencia (baseline exento).
                        correctness = apply_unanswerable_gate(
                            q["category"], cond, pages if cond != "baseline" else [], correctness
                        )
                    except Exception as exc:  # noqa: BLE001 — un fallo es un HALLAZGO, se registra
                        print(f"  [ERROR] {cond}/{q['id']}: {type(exc).__name__}: {exc}")
                        append_jsonl(
                            RUN_LOG,
                            {
                                "doc_id": doc_id,
                                "question_id": q["id"],
                                "condition": cond,
                                "error": f"{type(exc).__name__}: {exc}",
                            },
                        )
                        continue
                    rec = RunRecord(
                        doc_id=doc_id,
                        question_id=q["id"],
                        category=q["category"],
                        condition=cond,
                        rep=rep,
                        answer=answer,
                        retrieved_pages=pages if cond != "baseline" else [],
                        evidence_pages=q["evidence_pages"],
                        query_usd=gen.usd,
                        latency_s=round(time.monotonic() - t, 2),
                        usage={
                            "input_tokens": gen.input_tokens,
                            "output_tokens": gen.output_tokens,
                            "cache_read_input_tokens": gen.cache_read_input_tokens,
                            "cache_write_input_tokens": gen.cache_write_input_tokens,
                            "correctness": correctness,
                            "judge_usd": judge.usd,
                        },
                    )
                    append_jsonl(RUN_LOG, rec)
            print(f"  {q['id']} ok")
    print(f"\nConsultas registradas → {RUN_LOG}")


# ─────────────────────────────────────────────────────────────
# FASE REPORT
# ─────────────────────────────────────────────────────────────
def report_phase() -> None:
    rows = [
        json.loads(line)
        for line in RUN_LOG.read_text(encoding="utf-8").splitlines()
        if line.strip() and '"error"' not in line
    ]
    index_summary = (
        json.loads(INDEX_SUMMARY.read_text(encoding="utf-8")) if INDEX_SUMMARY.exists() else {}
    )

    def avg(xs):
        return round(sum(xs) / len(xs), 3) if xs else 0.0

    # Calidad y costo por condición.
    print("\n=== CALIDAD Y COSTO POR CONDICIÓN (todos los docs) ===")
    print(f"{'condición':16}{'correctness':>12}{'recall@k':>10}{'$consultas':>12}{'$juez':>9}")
    q_total = j_total = 0.0
    for cond in CONDITIONS:
        cr = [r["usage"]["correctness"] for r in rows if r["condition"] == cond]
        rc = [
            _recall(r["retrieved_pages"], r["evidence_pages"])
            for r in rows
            if r["condition"] == cond and r["evidence_pages"]
        ]
        qusd = sum(r["query_usd"] for r in rows if r["condition"] == cond)
        jusd = sum(r["usage"]["judge_usd"] for r in rows if r["condition"] == cond)
        q_total += qusd
        j_total += jusd
        rec_avg = avg([x for x in rc if x is not None])
        print(f"{cond:16}{avg(cr):>12}{rec_avg:>10}{round(qusd, 4):>12}{round(jusd, 4):>9}")

    # Calidad por categoría × condición.
    print("\n=== CORRECTNESS POR CATEGORÍA × CONDICIÓN ===")
    cats = sorted({r["category"] for r in rows})
    print(f"{'categoría':16}" + "".join(f"{c.split('_')[0][:9]:>11}" for c in CONDITIONS))
    for cat in cats:
        line = f"{cat:16}"
        for cond in CONDITIONS:
            cr = [
                r["usage"]["correctness"]
                for r in rows
                if r["condition"] == cond and r["category"] == cat
            ]
            line += f"{avg(cr):>11}"
        print(line)

    # Calidad por documento × condición.
    print("\n=== CORRECTNESS POR DOCUMENTO × CONDICIÓN ===")
    for doc_id in sorted({r["doc_id"] for r in rows}):
        line = f"{doc_id:16}"
        for cond in CONDITIONS:
            cr = [
                r["usage"]["correctness"]
                for r in rows
                if r["condition"] == cond and r["doc_id"] == doc_id
            ]
            line += f"{avg(cr):>11}"
        print(line)

    # Costos y punto de equilibrio.
    index_usd = index_summary.get("index_usd_total", 0.0)
    n_q = len({r["question_id"] for r in rows})
    print("\n=== COSTOS (USD) ===")
    print(f"  indexación (una vez, 3 docs): ${index_usd}")
    print(f"  consultas (Sonnet):           ${round(q_total, 4)}")
    print(f"  juez (Haiku):                 ${round(j_total, 4)}")
    print(f"  TOTAL:                        ${round(index_usd + q_total + j_total, 4)}")

    base_pq = sum(r["query_usd"] for r in rows if r["condition"] == "baseline") / max(1, n_q)
    vec_pq = sum(r["query_usd"] for r in rows if r["condition"] == "vector_rag") / max(1, n_q)
    if base_pq > vec_pq:
        be = index_usd / (base_pq - vec_pq)
        print(f"\n  Punto de equilibrio (vector_rag vs baseline): ~{be:.0f} preguntas por doc")
        print(
            f"    (baseline ${base_pq:.4f}/preg vs vector ${vec_pq:.4f}/preg; "
            f"indexar cuesta ${index_usd})"
        )
    else:
        print(
            f"\n  baseline (${base_pq:.4f}/preg) <= vector_rag (${vec_pq:.4f}/preg): "
            "indexar NO se amortiza a esta escala."
        )


def main() -> None:
    phase = sys.argv[1] if len(sys.argv) > 1 else "index"
    if phase == "index":
        asyncio.run(index_phase())
    elif phase == "query":
        asyncio.run(query_phase())
    elif phase == "report":
        report_phase()
    else:
        print(f"Fase desconocida: {phase}. Usa index | query | report.")


if __name__ == "__main__":
    main()
