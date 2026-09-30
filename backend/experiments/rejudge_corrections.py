"""Re-juicio acotado post-auditoría (Hito 7). NO regenera respuestas.

La auditoría (`docs/Auditoria_Dataset_Hito7.md`) encontró dos problemas con impacto medido:
1. La métrica de `unanswerable` premiaba el fallo de recuperación (abstención con `retrieved_pages
   == []` puntuaba 1.0). Se corrige con `apply_unanswerable_gate` (baseline exento).
2. El gold de `jv5` (lectura de una gráfica) era factualmente falso; ya se corrigió en
   `dataset.json`.

Este script re-juzga SOLO los 16 registros afectados (3 `unanswerable` × 4 + `jv5` × 4) con el
juez Haiku y la corrección aplicada, y reescribe `experiment.jsonl` (los otros 104 quedan intactos:
las respuestas que dieron los 4 sistemas no cambian, solo el criterio de evaluación y el gold).

Uso:  uv run --group experiments python -m experiments.rejudge_corrections
"""

from __future__ import annotations

import asyncio
import json

from .judge import apply_unanswerable_gate, judge_answer
from .run_experiment import RUN_LOG, load_dataset

UNANSWERABLE_IDS = {"at10", "jv10", "dc10"}
VISUAL_FIX_IDS = {"jv5"}
AFFECTED = UNANSWERABLE_IDS | VISUAL_FIX_IDS


async def main() -> None:
    _docs, questions = load_dataset()
    qmap = {q["id"]: q for q in questions}

    lines = RUN_LOG.read_text(encoding="utf-8").splitlines()
    records = [json.loads(line) for line in lines if line.strip()]

    judge_usd_total = 0.0
    changes: list[tuple[str, str, list[int], float, float]] = []
    for rec in records:
        qid = rec.get("question_id")
        if qid not in AFFECTED:
            continue
        q = qmap[qid]
        score, usage = await judge_answer(q["question"], q["reference_answer"], rec["answer"])
        if rec["category"] == "unanswerable":
            score = apply_unanswerable_gate(
                rec["category"], rec["condition"], rec["retrieved_pages"], score
            )
        old = rec["usage"]["correctness"]
        rec["usage"]["correctness"] = round(score, 3)
        rec["usage"]["judge_usd"] = round(usage.usd, 6)
        judge_usd_total += usage.usd
        changes.append((qid, rec["condition"], rec["retrieved_pages"], old, round(score, 3)))

    # Reescribe las 120 líneas (16 actualizadas, 104 idénticas). Se escribe al final: si algún
    # juicio fallara antes, el archivo original queda intacto.
    with RUN_LOG.open("w", encoding="utf-8") as fh:
        for rec in records:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")

    print("=== RE-JUICIO ACOTADO (16 registros, sin regenerar respuestas) ===")
    print(f"{'qid':6}{'condición':16}{'retrieved_pages':>26}{'antes':>8}{'después':>9}")
    for qid, cond, retr, old, new in sorted(changes):
        flag = "   <-- cambia" if old != new else ""
        print(f"{qid:6}{cond:16}{str(retr):>26}{old:>8.3f}{new:>9.3f}{flag}")
    print(f"\nRe-juicios: {len(changes)} · costo real juez (Haiku): ${round(judge_usd_total, 4)}")


if __name__ == "__main__":
    asyncio.run(main())
