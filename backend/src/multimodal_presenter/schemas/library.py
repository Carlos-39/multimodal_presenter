"""Contrato de la biblioteca: lo que se guarda y lo que se lista.

Envuelve al contrato de datos sin tocarlo. `PayloadGuardado` contiene la `Presentation` tal cual,
pero quién la guardó vive FUERA, en la base: la propiedad no es una propiedad del resultado, es
del acto de guardarlo. Y además `Presentation` viaja a los modelos, así que un identificador de
usuario dentro del contrato acabaría en un prompt por una ruta perfectamente normal.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from .presentation import Presentation
from .transform import ChartNote, GroundingReport, SourceKind

VERSION_CONTRATO = 1
"""Versión del formato guardado. No es ceremonia: el contrato cambió dos veces este mes
(`start_s` en A1, `region` en el resaltado por región). Sin esto, el primer cambio dejaría
ilegibles las presentaciones ya guardadas de todo el mundo."""


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PayloadGuardado(_Strict):
    """Todo lo que hace falta para volver a MOSTRAR una presentación tal como quedó.

    Se valida al guardar, no al leer: así una presentación corrupta no llega nunca a la base, y lo
    que se recupera meses después se sabe que es válido porque lo era al entrar.
    """

    presentation: Presentation
    grounding: GroundingReport
    chart_notes: list[ChartNote] = Field(default_factory=list)
    transcript: str | None = None
    audio_evidence: str | None = None


class ResumenPresentacion(_Strict):
    """Una fila de "mis presentaciones". Sin el payload.

    Listar no debe traerse el contenido: un deck con imágenes pesa megas y la lista solo necesita
    saber de qué es cada cosa.
    """

    id: str
    titulo: str
    document_id: str
    source_kind: SourceKind
    nombre_archivo: str | None
    creada_en: str


class ListaPresentaciones(_Strict):
    presentaciones: list[ResumenPresentacion] = Field(default_factory=list)


class PresentacionCompleta(_Strict):
    """Una presentación guardada, con lo necesario para seguir usándola.

    Lleva `document_id` porque sin él la presentación restaurada sería un artefacto a medias: el
    chat, el deck, el panel de fuente y el visor de página necesitan el documento original, y el
    navegador que la abre mañana ya no tiene el archivo.
    """

    id: str
    titulo: str
    document_id: str
    source_kind: SourceKind
    nombre_archivo: str | None
    media_type: str | None
    creada_en: str
    payload: PayloadGuardado
