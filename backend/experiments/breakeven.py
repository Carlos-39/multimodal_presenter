"""Punto de equilibrio del RAG vectorial frente al baseline, recálculo auditable (Hito 7).

La primera versión del Registro afirmaba que indexar "solo se paga tras ~267 preguntas por
documento". Era incorrecto por dos órdenes de magnitud y, para los documentos donde la pregunta
importa, al revés. Este script rehace la cuenta **desde los datos crudos del experimento**, sin
volver a llamar a ningún modelo: todo sale de `runs/experiment.jsonl` y de `index_summary.json`.

Los tres errores que corrige:

1. **Mezcla de escalas.** Comparaba la indexación de los TRES documentos ($4.61) contra un ritmo
   de preguntas POR documento.
2. **Costo equivocado.** Usaba la indexación TOTAL, dominada por el grafo de LightRAG y la
   transcripción. El RAG vectorial no necesita ninguna de las dos: solo los embeddings de Voyage
   (`voyage_usd`), que son centavos.
3. **Promedio global.** Usaba un costo por pregunta único cuando varía ~4x según el tamaño del
   documento, porque el baseline manda el documento entero en cada turno.

Imprime además el control de caché: si el baseline hubiera escrito caché en cada pregunta, sus
costos estarían inflados frente al uso interactivo real. (No es el caso: 27 de 30 la leyeron.)

Uso:  uv run python experiments/breakeven.py
No llama a ninguna API. No corre en CI ni en pytest.
"""

from __future__ import annotations

import json
import statistics as st
import sys
from pathlib import Path

DATA = Path(__file__).parent / "data" / "runs"
RUNS = DATA / "experiment.jsonl"
INDEX = DATA / "index_summary.json"

DOCS = ("attention", "juanvaldez", "decreto1016")


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    if not RUNS.exists() or not INDEX.exists():
        print(f"Faltan los datos del experimento en {DATA}.")
        print("Son los que produjo la corrida del Hito 7; están fuera de git por tamaño.")
        return 2

    rows = [json.loads(line) for line in RUNS.read_text(encoding="utf-8").splitlines() if line]
    idx = json.loads(INDEX.read_text(encoding="utf-8"))["per_doc"]

    def coste(doc: str, cond: str) -> float:
        vals = [r["query_usd"] for r in rows if r["doc_id"] == doc and r["condition"] == cond]
        return st.mean(vals)

    # --- Control de caché: ¿son costos de uso real o inflados por escrituras? ---
    base = [r for r in rows if r["condition"] == "baseline"]
    escriben = sum(1 for r in base if r["usage"].get("cache_write_input_tokens", 0) > 0)
    leen = sum(1 for r in base if r["usage"].get("cache_read_input_tokens", 0) > 0)
    print(f"Control de caché del baseline: {leen}/{len(base)} leyeron, {escriben} escribieron.")
    print("  (si casi todas leyeran, los costos son de uso interactivo real, no inflados)\n")

    print("Costo por pregunta y punto de equilibrio, por documento:\n")
    print(
        f"{'documento':14s} {'pp':>4s} {'baseline':>10s} {'vector':>10s} "
        f"{'ahorro':>9s} {'índice vec':>11s}  equilibrio"
    )
    for doc in DOCS:
        info = idx[doc]
        b, v = coste(doc, "baseline"), coste(doc, "vector_rag")
        ahorro = b - v
        indice = info["voyage_usd"]
        if ahorro <= 0:
            veredicto = "nunca: el baseline ya es más barato por pregunta"
        else:
            veredicto = f"~{indice / ahorro:.1f} preguntas"
        print(
            f"{doc:14s} {info['pages']:4d} {b:10.4f} {v:10.4f} "
            f"{ahorro:9.4f} {indice:11.4f}  {veredicto}"
        )

    print(
        "\nEl costo del baseline escala con el tamaño del documento (manda el documento entero,\n"
        "aunque esté cacheado); el del vectorial es plano (k páginas). De ahí el cruce."
    )
    print(
        "\nPara comparar: la indexación TOTAL que usaba el cálculo viejo incluye el grafo de\n"
        "LightRAG y la transcripción, que el RAG vectorial NO necesita:"
    )
    for doc in DOCS:
        info = idx[doc]
        print(
            f"  {doc:14s} vectorial (voyage) ${info['voyage_usd']:.4f}  "
            f"vs  total (con grafo) ${info['index_usd']:.4f}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
