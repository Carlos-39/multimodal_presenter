"""Unicidad de los ids de sección (Fase 3 determinista).

El `Section.id` lo genera el LLM y puede repetirlo. Con ids repetidos se rompen dos cosas a la
vez: el join del grounding (`SectionGrounding.section_id` → `Section.id`) queda ambiguo, y el
frontend puede PERDER una sección, porque React usa el id como `key` de la lista.

Se corrige de forma determinista en vez de rechazar la generación entera (mismo criterio que la
regla de isomorfismo del 5a). Estos tests fijan ese comportamiento.
"""

import asyncio
import json

from pydantic_ai.models.test import TestModel

from multimodal_presenter.pipeline import transform
from multimodal_presenter.pipeline.extraction import prepare_input
from multimodal_presenter.pipeline.streaming import transform_stream
from multimodal_presenter.pipeline.validation import SectionIdDeduper, verify_grounding
from multimodal_presenter.schemas import Presentation
from multimodal_presenter.schemas.presentation import Section

TEXTO = "La empresa creció. Las ventas subieron. Los costos bajaron."


def _seccion(sec_id: str, cita: str) -> Section:
    return Section.model_validate(
        {
            "id": sec_id,
            "role": "core",
            "source": {"document_id": "d", "quote": cita},
            "content": {"content_type": "text", "text": "x"},
        }
    )


def _presentacion(ids: list[str]) -> dict:
    return {
        "title": "t",
        "sections": [
            {
                "id": sec_id,
                "role": "core",
                "source": {"document_id": "d", "quote": "La empresa creció."},
                "content": {"content_type": "text", "text": f"contenido {i}"},
            }
            for i, sec_id in enumerate(ids)
        ],
    }


# ─────────────────────────────────────────────────────────────
# La regla, aislada
# ─────────────────────────────────────────────────────────────
def test_los_ids_distintos_no_se_tocan() -> None:
    d = SectionIdDeduper()
    for sec_id in ("s1", "s2", "s3"):
        seccion, renombrada = d.ensure_unique(_seccion(sec_id, "q"))
        assert seccion.id == sec_id
        assert renombrada is None


def test_un_id_repetido_se_renombra_con_sufijo() -> None:
    d = SectionIdDeduper()
    primera, _ = d.ensure_unique(_seccion("s1", "q"))
    segunda, renombrada = d.ensure_unique(_seccion("s1", "q"))
    assert primera.id == "s1"
    assert segunda.id == "s1-2"
    assert renombrada == "s1"  # se reporta el original para poder trazarlo


def test_varios_repetidos_siguen_la_serie() -> None:
    d = SectionIdDeduper()
    ids = [d.ensure_unique(_seccion("s1", "q"))[0].id for _ in range(4)]
    assert ids == ["s1", "s1-2", "s1-3", "s1-4"]


def test_no_colisiona_con_un_id_que_ya_parecia_renombrado() -> None:
    """Si el modelo ya emitió `s1-2` por su cuenta, el renombrado debe saltárselo."""
    d = SectionIdDeduper()
    assert d.ensure_unique(_seccion("s1", "q"))[0].id == "s1"
    assert d.ensure_unique(_seccion("s1-2", "q"))[0].id == "s1-2"
    assert d.ensure_unique(_seccion("s1", "q"))[0].id == "s1-3"


def test_es_determinista() -> None:
    """Misma entrada → misma salida siempre (Punto 1.5: consistencia entre generaciones)."""
    entradas = ["a", "b", "a", "a", "b"]
    corridas = [
        [SectionIdDeduper().ensure_unique(_seccion(i, "q"))[0].id for i in entradas]
        for _ in range(3)
    ]
    assert corridas[0] == corridas[1] == corridas[2]


def test_no_pierde_ninguna_seccion_ni_su_contenido() -> None:
    d = SectionIdDeduper()
    originales = [_seccion("s1", f"cita {i}") for i in range(3)]
    salidas = [d.ensure_unique(s)[0] for s in originales]
    assert len(salidas) == 3
    assert [s.source.quote for s in salidas] == ["cita 0", "cita 1", "cita 2"]


# ─────────────────────────────────────────────────────────────
# Integrada en el pipeline: el grounding deja de ser ambiguo
# ─────────────────────────────────────────────────────────────
def test_el_grounding_referencia_ids_unicos() -> None:
    pres = Presentation.model_validate(_presentacion(["s1", "s1", "s2"]))
    ext = prepare_input(text=TEXTO)
    nueva, reporte = verify_grounding(pres, ext)

    ids = [s.id for s in nueva.sections]
    assert ids == ["s1", "s1-2", "s2"]
    # Cada entrada del reporte apunta a UNA sección concreta: el join ya no es ambiguo.
    assert [e.section_id for e in reporte.sections] == ids
    assert len(set(ids)) == len(ids)
    assert reporte.total_sections == 3  # no se perdió ninguna


def test_pipeline_completo_con_ids_repetidos() -> None:
    modelo = TestModel(custom_output_text=json.dumps(_presentacion(["dup", "dup", "dup"])))
    resultado = asyncio.run(transform(modelo, text=TEXTO, semantic_enabled=False))
    ids = [s.id for s in resultado.presentation.sections]
    assert ids == ["dup", "dup-2", "dup-3"]
    assert [e.section_id for e in resultado.grounding.sections] == ids


def test_streaming_dedupe_a_lo_largo_del_stream() -> None:
    """En streaming el deduper vive todo el stream: un id ya emitido cuenta para el siguiente."""
    modelo = TestModel(custom_output_text=json.dumps(_presentacion(["a", "a", "b", "a"])))

    async def run() -> list:
        return [
            e
            async for e in transform_stream(modelo, text=TEXTO, semantic_enabled=False)
            if e.type == "section"
        ]

    eventos = asyncio.run(run())
    ids = [e.section.id for e in eventos]
    assert ids == ["a", "a-2", "b", "a-3"]
    # La entrada de grounding de cada evento apunta a su propia sección.
    assert [e.grounding.section_id for e in eventos] == ids
