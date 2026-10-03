"""Batería de diagnóstico — ¿por qué aparece texto dentro de las imágenes generadas?

NO ES CÓDIGO DE PRODUCCIÓN. Mide una cosa concreta: en cuántas imágenes aparece texto no deseado,
con el prompt ACTUAL y con el prompt propuesto, sobre los mismos casos y el mismo proveedor; y de
paso compara Ideogram con Gemini bajo el prompt mejorado, que es el que se usaría igual.

Diseño del experimento:

- **Los prompts de imagen son REALES**, generados por el propio clasificador del 5h sobre
  contenidos variados, no escritos a mano para la ocasión. Si se escribieran a mano se estaría
  midiendo otra cosa.
- **La variante B solo cambia la capa que vive en `_generate_image`** (bloque de estilo y
  `negative_prompt`), no el `image_prompt` del clasificador. Así A y B comparten exactamente el
  mismo cuerpo y la comparación aísla lo que un arreglo tocaría sin rehacer el clasificador.
- **Gemini se prueba con la variante B**, no con la A: el prompt mejorado se va a usar de todos
  modos, así que la pregunta útil es cuál proveedor va mejor CON él.

Cada imagen se guarda en disco y el índice se escribe en JSON a medida que avanza: si una llamada
falla a mitad, lo ya pagado no se pierde ni se vuelve a pedir.

Uso (desde backend/):
    uv run python experiments/bateria_texto_en_imagenes.py
"""

from __future__ import annotations

import asyncio
import base64
import json
import sys
from pathlib import Path

import httpx

from multimodal_presenter.config import get_settings
from multimodal_presenter.pipeline.illustration import (
    _IDEOGRAM_NEGATIVE,
    _IDEOGRAM_URL,
    _IMAGE_STYLE,
)

SALIDA = Path(__file__).resolve().parent / "outputs" / "texto_en_imagenes"
INDICE = SALIDA / "indice.json"

MODELO_GEMINI = "gemini-3.1-flash-image"  # Nano Banana 2: rango de precio comparable a Ideogram

# ── Variante B: el arreglo que se propone ────────────────────────────────────
#
# Cinco cambios respecto de la variante A, cada uno atacando una causa del diagnóstico:
# 1. En INGLÉS. La documentación de Ideogram recomienda inglés para resultados fiables.
# 2. La restricción va PRIMERO, no enterrada tras 60 palabras de descripción.
# 3. En POSITIVO ("todo el significado lo llevan formas y flechas") además de en negativo:
#    Ideogram documenta que maneja mal la negación pura.
# 4. Se quita "alta legibilidad visual": nombrar la legibilidad en la misma frase que prohíbe el
#    texto es pedirle al modelo justo en lo que no debe pensar.
# 5. Se deja de pedir un "diagrama" como género; se pide ilustración SIN PALABRAS.
_ESTILO_B_PREFIJO = (
    "WORDLESS EDUCATIONAL ILLUSTRATION. This image contains no writing of any kind: no words, "
    "no labels, no captions, no titles, no numbers, no watermark, no signature. All meaning is "
    "carried by shapes, colour, arrows and composition alone. Clean light background, detailed "
    "and clear artwork, not a vague abstract icon. Subject to depict: "
)
# Se excluyen palabras/letras/etiquetas pero NO números: es la decisión ya tomada en el 5j
# (excluir números se consideró demasiado). Lo que cambia aquí es el IDIOMA, no el criterio.
_NEGATIVO_B = (
    "text, words, letters, labels, captions, titles, subtitles, watermark, logo, signature, "
    "typography, handwriting, annotations"
)
_STYLE_TYPE_B = "GENERAL"  # explícito: DESIGN es el de pósters, el que más texto mete


def variante_a(image_prompt: str) -> tuple[str, str, str | None]:
    """Lo que el sistema envía HOY."""
    return image_prompt + _IMAGE_STYLE, _IDEOGRAM_NEGATIVE, None


def variante_b(image_prompt: str) -> tuple[str, str, str | None]:
    """El arreglo propuesto."""
    return _ESTILO_B_PREFIJO + image_prompt, _NEGATIVO_B, _STYLE_TYPE_B


# ── Contenidos de prueba: variados y del tipo que el sistema procesa de verdad ──
CONTENIDOS = [
    (
        "tormenta",
        "Cuando un rayo intenso golpea el suelo desde una tormenta, remueve carga positiva de la "
        "nube. Ese desequilibrio genera un campo electrico que sube hasta la mesosfera, donde "
        "ioniza el nitrogeno y produce un resplandor rojo.",
    ),
    (
        "ciclo_agua",
        "El sol evapora el agua del oceano, el vapor asciende y se condensa formando nubes, cae "
        "como lluvia sobre la montana y vuelve al mar por los rios.",
    ),
    (
        "celula",
        "La celula eucariota tiene un nucleo central rodeado de citoplasma, con mitocondrias "
        "dispersas y una membrana que la separa del exterior.",
    ),
    (
        "cafe",
        "El grano de cafe pasa por el despulpado, luego la fermentacion en tanques, el lavado con "
        "agua limpia, el secado al sol en patios y finalmente la trilla que retira el pergamino.",
    ),
    (
        "volcan",
        "El magma asciende desde la camara magmatica por la chimenea del volcan, empuja los gases "
        "acumulados y sale por el crater, formando una columna de ceniza que el viento dispersa.",
    ),
    (
        "puente",
        "Un puente colgante sostiene el tablero mediante tirantes verticales que cuelgan de dos "
        "cables principales, anclados en los extremos y apoyados sobre dos torres.",
    ),
]


async def prompts_reales() -> list[tuple[str, str]]:
    """Genera los `image_prompt` con el clasificador REAL del 5h (Haiku, céntimos)."""
    from multimodal_presenter.model_provider import build_summary_model
    from multimodal_presenter.pipeline.illustration import _classify
    from multimodal_presenter.schemas import Presentation

    settings = get_settings()
    modelo = build_summary_model(settings)
    salida: list[tuple[str, str]] = []
    for nombre, texto in CONTENIDOS:
        pres = Presentation.model_validate(
            {
                "title": nombre,
                "sections": [
                    {
                        "id": "s1",
                        "role": "core",
                        "source": {"document_id": "d", "quote": "x"},
                        "content": {"content_type": "text", "text": texto},
                    }
                ],
            }
        )
        planes = await _classify(modelo, pres)
        if planes:
            salida.append((nombre, planes[0].image_prompt))
        else:
            print(f"  (el clasificador no marcó '{nombre}' — se omite)")
    return salida


async def genera_ideogram(prompt: str, negativo: str, style_type: str | None) -> bytes:
    settings = get_settings()
    campos: dict[str, tuple[None, str]] = {
        "prompt": (None, prompt),
        "negative_prompt": (None, negativo),
        "rendering_speed": (None, settings.ideogram_rendering_speed),
        "aspect_ratio": (None, "1x1"),
        "magic_prompt": (None, "OFF"),
    }
    if style_type:
        campos["style_type"] = (None, style_type)
    async with httpx.AsyncClient(timeout=180) as client:
        resp = await client.post(
            _IDEOGRAM_URL, headers={"Api-Key": settings.ideogram_api_key or ""}, files=campos
        )
        resp.raise_for_status()
        img = await client.get(resp.json()["data"][0]["url"])
        img.raise_for_status()
        return img.content


async def genera_gemini(prompt: str) -> bytes:
    """Gemini no tiene `negative_prompt`: la restricción va toda en el prompt (ya va primero)."""
    from google import genai

    settings = get_settings()
    cliente = genai.Client(api_key=settings.google_api_key)
    respuesta = await asyncio.to_thread(
        cliente.models.generate_content, model=MODELO_GEMINI, contents=prompt
    )
    for parte in respuesta.candidates[0].content.parts:
        datos = getattr(parte, "inline_data", None)
        if datos and datos.data:
            return datos.data if isinstance(datos.data, bytes) else base64.b64decode(datos.data)
    raise RuntimeError("Gemini no devolvió imagen")


def carga_indice() -> dict:
    if INDICE.exists():
        return json.loads(INDICE.read_text(encoding="utf-8"))
    return {"prompts": {}, "imagenes": {}}


def guarda_indice(indice: dict) -> None:
    SALIDA.mkdir(parents=True, exist_ok=True)
    INDICE.write_text(json.dumps(indice, ensure_ascii=False, indent=2), encoding="utf-8")


async def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    SALIDA.mkdir(parents=True, exist_ok=True)
    indice = carga_indice()

    if not indice["prompts"]:
        print("Generando los image_prompt con el clasificador real...")
        for nombre, prompt in await prompts_reales():
            indice["prompts"][nombre] = prompt
        guarda_indice(indice)
    print(f"{len(indice['prompts'])} prompts reales listos\n")

    # (clave, proveedor, constructor de variante)
    tandas = [
        ("ideogram_A", "ideogram", variante_a),
        ("ideogram_B", "ideogram", variante_b),
        ("gemini_B", "gemini", variante_b),
    ]

    for etiqueta, proveedor, construye in tandas:
        print(f"── {etiqueta} ──")
        for nombre, image_prompt in indice["prompts"].items():
            clave = f"{etiqueta}__{nombre}"
            destino = SALIDA / f"{clave}.png"
            if clave in indice["imagenes"] and destino.exists():
                print(f"  {nombre}: ya estaba, se reusa")
                continue
            prompt, negativo, style_type = construye(image_prompt)
            try:
                if proveedor == "ideogram":
                    datos = await genera_ideogram(prompt, negativo, style_type)
                else:
                    datos = await genera_gemini(prompt)
                destino.write_bytes(datos)
                indice["imagenes"][clave] = {
                    "archivo": destino.name,
                    "prompt": prompt,
                    "negative_prompt": negativo if proveedor == "ideogram" else None,
                    "style_type": style_type if proveedor == "ideogram" else None,
                }
                guarda_indice(indice)  # tras CADA imagen: lo pagado no se pierde
                print(f"  {nombre}: OK ({len(datos) // 1024} KB)")
            except Exception as exc:  # noqa: BLE001 — se anota y se sigue con las demás
                print(f"  {nombre}: FALLÓ ({type(exc).__name__}: {str(exc)[:90]})")

    print(f"\nImágenes en: {SALIDA}")
    print(f"Generadas en total: {len(indice['imagenes'])}")


if __name__ == "__main__":
    asyncio.run(main())
