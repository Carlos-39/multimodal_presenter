"""Contrato de la biblioteca: lo que se guarda y lo que se lista.

Envuelve al contrato de datos sin tocarlo. `PayloadGuardado` contiene la `Presentation` tal cual,
pero quién la guardó vive FUERA, en la base: la propiedad no es una propiedad del resultado, es
del acto de guardarlo. Y además `Presentation` viaja a los modelos, así que un identificador de
usuario dentro del contrato acabaría en un prompt por una ruta perfectamente normal.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .chat import ChatResponse
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


class MensajeGuardado(_Strict):
    """Un mensaje del chat tal como se guarda.

    Lleva el `ChatResponse` COMPLETO y no solo el texto. El historial que viaja al modelo sí es
    solo texto (`ChatTurn`), pero lo que hay que poder volver a mostrar es la respuesta con su
    ancla: una respuesta restaurada sin su cita sería afirmación sin respaldo, que es exactamente
    lo que este proyecto dice no hacer.
    """

    rol: Literal["user", "assistant"]
    texto: str = Field(min_length=1)
    respuesta: ChatResponse | None = None

    @model_validator(mode="after")
    def _solo_el_asistente_responde(self) -> MensajeGuardado:
        if self.rol == "user" and self.respuesta is not None:
            raise ValueError("un mensaje del usuario no lleva respuesta anclada")
        return self


class HistorialChat(_Strict):
    """El historial completo de una presentación.

    Se manda COMPLETO y reemplaza al guardado, en vez de añadir un turno cada vez. Así lo
    almacenado es siempre una foto de lo que se está viendo y no puede derivar: añadiendo, un
    reintento duplicaría un turno y una petición perdida dejaría un hueco, y el historial dejaría
    de coincidir con la conversación que de verdad ocurrió.
    """

    mensajes: list[MensajeGuardado] = Field(default_factory=list, max_length=200)


class ActualizacionPresentacion(_Strict):
    """Lo que se manda al completar una presentación ya guardada.

    Viaja como JSON y no como formulario a propósito: un payload con ilustraciones son varios
    megas (son data URIs), y los campos de formulario que no son archivo están topados en 1 MB por
    el analizador de multipart. Aquí no hay documento que subir, así que no hace falta multipart.
    """

    titulo: str = Field(min_length=1, max_length=300)
    payload: PayloadGuardado


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
    chat: list[MensajeGuardado] = Field(default_factory=list)
    """El historial de chat viene en la MISMA respuesta que la presentación, no en una segunda
    petición. Restaurar es un solo acto: con dos peticiones habría un instante en el que la
    presentación ya está en pantalla y su conversación todavía no, y ese instante se ve."""

    tiene_deck: bool = False
    """Si hay diapositivas guardadas. El deck NO viaja aquí —con ilustraciones pesa megas, y
    abrir una presentación tiene que ser inmediato—, pero saber que existe es lo que deja que el
    botón diga «Abrir presentación» en vez de ofrecer generarla otra vez."""

    tiene_narracion: bool = False
    """Si hay un mp3 guardado. Mismo criterio: el audio se pide al pulsar, no al restaurar."""
