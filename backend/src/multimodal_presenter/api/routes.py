"""Endpoint de transformación (Hito 4: multipart con texto y/o archivo).

Acepta `multipart/form-data` con un campo de texto y/o un archivo (PDF/imagen). Debe venir
al menos uno de los dos. Cuando vienen ambos, el texto se pasa como instrucción/contexto
junto al binario del documento. Mantiene el envelope de respuesta {presentation, grounding}.
"""

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from pydantic_ai.models import Model

from ..config import Settings, get_settings
from ..model_provider import build_model
from ..pipeline import transform
from ..pipeline.uploads import read_and_validate_upload
from ..schemas.transform import TransformResponse

router = APIRouter(tags=["pipeline"])


def get_model(settings: Settings = Depends(get_settings)) -> Model:
    """Provee el modelo (Anthropic + fallback OpenRouter). Sobreescribible en tests."""
    return build_model(settings)


@router.post("/transform", response_model=TransformResponse)
async def transform_endpoint(
    response: Response,
    text: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    model: Model = Depends(get_model),
    settings: Settings = Depends(get_settings),
) -> TransformResponse:
    """Recibe texto y/o un archivo y devuelve la presentación + el reporte de grounding."""
    text_value = text.strip() if text else None
    has_file = file is not None and file.filename

    if not text_value and not has_file:
        raise HTTPException(status_code=400, detail="Debes enviar texto, un archivo, o ambos.")

    binary: bytes | None = None
    media_type: str | None = None
    filename: str | None = None
    if has_file:
        max_bytes = settings.max_upload_mb * 1024 * 1024
        binary, media_type = await read_and_validate_upload(file, max_bytes)
        filename = file.filename

    result = await transform(
        model,
        text=text_value,
        binary=binary,
        media_type=media_type,
        filename=filename,
    )

    response.headers["X-Grounding-Warnings"] = str(result.grounding.not_found_sections)
    return TransformResponse(
        presentation=result.presentation,
        grounding=result.grounding,
        semantic=result.semantic,
        chart_notes=result.chart_notes,
    )
