"""Endpoints de transformación.

- `POST /transform` — multipart (texto y/o archivo), respuesta única con el envelope.
- `POST /transform/stream` — igual entrada, pero emite las secciones por SSE a medida que
  el LLM las termina (Hito 5d). `/transform` queda como fallback de compatibilidad.
"""

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from fastapi.responses import StreamingResponse
from pydantic_ai.models import Model

from ..config import Settings, get_settings
from ..model_provider import build_model
from ..pipeline import transform
from ..pipeline.streaming import transform_stream
from ..pipeline.uploads import read_and_validate_upload
from ..schemas.transform import StreamError, TransformResponse

router = APIRouter(tags=["pipeline"])


def get_model(settings: Settings = Depends(get_settings)) -> Model:
    """Provee el modelo (Anthropic + fallback OpenRouter). Sobreescribible en tests."""
    return build_model(settings)


async def _parse_inputs(
    text: str | None, file: UploadFile | None, settings: Settings
) -> tuple[str | None, bytes | None, str | None, str | None]:
    """Valida la entrada (al menos uno; tipo/tamaño del archivo). Lanza HTTPException."""
    text_value = text.strip() if text else None
    has_file = file is not None and file.filename
    if not text_value and not has_file:
        raise HTTPException(status_code=400, detail="Debes enviar texto, un archivo, o ambos.")

    binary: bytes | None = None
    media_type: str | None = None
    filename: str | None = None
    if has_file:
        assert file is not None
        max_bytes = settings.max_upload_mb * 1024 * 1024
        binary, media_type = await read_and_validate_upload(file, max_bytes)
        filename = file.filename
    return text_value, binary, media_type, filename


@router.post("/transform", response_model=TransformResponse)
async def transform_endpoint(
    response: Response,
    text: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    model: Model = Depends(get_model),
    settings: Settings = Depends(get_settings),
) -> TransformResponse:
    """Recibe texto y/o un archivo y devuelve la presentación + el reporte de grounding."""
    text_value, binary, media_type, filename = await _parse_inputs(text, file, settings)

    result = await transform(
        model,
        text=text_value,
        binary=binary,
        media_type=media_type,
        filename=filename,
        semantic_enabled=settings.semantic_verification_enabled,
    )

    response.headers["X-Grounding-Warnings"] = str(result.grounding.not_found_sections)
    return TransformResponse(
        presentation=result.presentation,
        grounding=result.grounding,
        semantic=result.semantic,
        chart_notes=result.chart_notes,
    )


@router.post("/transform/stream")
async def transform_stream_endpoint(
    text: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    model: Model = Depends(get_model),
    settings: Settings = Depends(get_settings),
) -> StreamingResponse:
    """Igual que /transform pero emite las secciones por Server-Sent Events (SSE).

    La validación de entrada (400/413/415) ocurre ANTES del stream (respuesta HTTP normal).
    Un fallo del modelo a mitad del stream se emite como evento `error` (no una presentación
    silenciosamente incompleta).
    """
    text_value, binary, media_type, filename = await _parse_inputs(text, file, settings)

    async def event_source():
        try:
            async for event in transform_stream(
                model,
                text=text_value,
                binary=binary,
                media_type=media_type,
                filename=filename,
                semantic_enabled=settings.semantic_verification_enabled,
            ):
                yield f"data: {event.model_dump_json()}\n\n"
        except Exception:
            err = StreamError(message="La generación se interrumpió.")
            yield f"data: {err.model_dump_json()}\n\n"

    return StreamingResponse(event_source(), media_type="text/event-stream")
