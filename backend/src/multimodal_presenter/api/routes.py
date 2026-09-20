"""Endpoint de transformación (Hito 2).

El modelo se inyecta por dependencia de FastAPI (`get_model`): en producción lo construye
desde la config (clave obligatoria); en tests se sobreescribe con un modelo mock, así el
CI no necesita clave real.
"""

from fastapi import APIRouter, Depends, Response
from pydantic_ai.models import Model

from ..config import Settings, get_settings
from ..model_provider import build_google_model
from ..pipeline import transform
from ..schemas.transform import TransformRequest, TransformResponse

router = APIRouter(tags=["pipeline"])


def get_model(settings: Settings = Depends(get_settings)) -> Model:
    """Provee el modelo Gemini. Sobreescribible en tests vía dependency_overrides."""
    return build_google_model(settings)


@router.post("/transform", response_model=TransformResponse)
async def transform_endpoint(
    request: TransformRequest,
    response: Response,
    model: Model = Depends(get_model),
) -> TransformResponse:
    """Recibe texto y devuelve la presentación estructurada + el reporte de grounding."""
    result = await transform(request.text, model=model)
    response.headers["X-Grounding-Warnings"] = str(result.grounding.ungrounded_sections)
    return TransformResponse(presentation=result.presentation, grounding=result.grounding)
