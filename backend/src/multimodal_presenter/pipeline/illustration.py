"""Ilustraciones de apoyo GENERADAS (Hito 5h Parte 1).

Reapertura acotada de una decisión de Fase 2: se genera una ilustración SOLO cuando (1) la sección
no tiene imagen real del documento (a nivel de documento: solo fuentes de texto, que no traen
imágenes), (2) el contenido se beneficia genuinamente de apoyo visual (proceso físico, mecanismo
espacial o secuencia visual: rúbrica fija, no juicio libre), y (3) es ayuda didáctica, nunca
prueba (estructuralmente: `GeneratedIllustration` no tiene `source`). Etiqueta obligatoria siempre.

Flujo: un clasificador barato (Haiku) decide qué núcleos califican y da un prompt de imagen; luego
se genera la imagen. Cacheado por documento. Techo de seguridad para acotar el costo. La condición 1
(solo texto) la aplica el frontend al decidir si llama a este flujo.

Generación de imagen (compartida con el deck 5j): proveedor PRIMARIO Ideogram (mejores dibujos), con
FALLBACK a OpenAI gpt-image-1 si falla (patrón como el FallbackModel del LLM). Las imágenes se
generan **SIN texto** (las etiquetas van en el HTML de la slide): así se evitan los typos que los
modelos de imagen cometen al "dibujar" palabras, y el texto que ve el usuario es siempre correcto.
"""

from __future__ import annotations

import base64
import hashlib
import ipaddress
from urllib.parse import urlsplit

import httpx
import logfire
import truststore
from pydantic import BaseModel, Field
from pydantic_ai import Agent, BinaryContent, PromptedOutput
from pydantic_ai.models import Model

from ..config import Settings
from ..schemas.presentation import (
    ChartContent,
    GeneratedIllustration,
    Presentation,
    TableContent,
    TextContent,
    TimelineContent,
)

truststore.inject_into_ssl()  # SSL del sistema (Windows)

_SAFETY_CAP = 4  # techo por documento: la rúbrica suele dar 1-2; esto acota el peor caso de costo
# La imagen tiene que ENTENDERSE SOLA. No basta con que no lleve texto: tampoco puede llevar
# marcas que remitan a información que no está dentro de la imagen, numeración de pasos, letras
# clave, leyendas, líneas guía que apuntan a un hueco. Una referencia huérfana es PEOR que nada,
# porque el lector busca una explicación que no existe. (Lo señaló el autor al revisar la batería
# de diagnóstico: una foto con símbolos y sin clave deja peor a quien no conoce el tema.)
#
# Va en INGLÉS y con la restricción PRIMERO, no enterrada al final: así se midió que funciona.
# Y se dice también en POSITIVO (con qué SÍ se construye el significado), porque los modelos de
# imagen siguen mal las instrucciones puramente negativas.
_IMAGE_STYLE_PREFIX = (
    "SELF-EXPLANATORY WORDLESS ILLUSTRATION. Someone who knows nothing about the topic must "
    "understand it from the picture alone, with no key or caption to consult.\n"
    "The image contains NO writing and NO reference marks: no words, labels, captions or titles; "
    "no callout numbers like (1) (2) (3); no letter keys; no legend; no leader lines pointing at "
    "empty space; no watermark or signature.\n"
    "Show meaning only with: recognizable objects drawn clearly, their arrangement in space, "
    "arrows for direction or flow, and colour. If there is a sequence, lay the stages out in "
    "reading order with arrows between them, never number them.\n"
    "Clean light background, detailed and clear artwork, not a vague abstract icon.\n"
    "Subject to depict: "
)


def has_image_provider(settings: Settings) -> bool:
    """¿Hay con qué generar imágenes? (Gemini primario, Ideogram u OpenAI de respaldo)."""
    return bool(settings.google_api_key or settings.ideogram_api_key or settings.openai_api_key)


class _Plan(BaseModel):
    section_id: str
    image_prompt: str = Field(min_length=1)


class _PlanList(BaseModel):
    items: list[_Plan] = Field(default_factory=list)


_CLASSIFY_SYSTEM = (
    "Recibes las secciones NÚCLEO de una presentación. Marca SOLO las que se benefician "
    "genuinamente de una ilustración de apoyo: contenido que describe un PROCESO físico/natural, "
    "un MECANISMO o estructura ESPACIAL, o una SECUENCIA visual. NO marques texto conceptual, "
    "definicional, narrativo, argumentativo, de datos/cifras ni resúmenes. Para cada sección "
    "marcada, da un `image_prompt` en español DETALLADO que describa una ilustración que EXPLIQUE "
    "el concepto SOLO con elementos visuales: nombra los objetos a dibujar y cómo se relacionan o "
    "fluyen (flechas, posición, color). La imagen debe entenderse SOLA, sin leyenda: NO pidas "
    "texto ni etiquetas dentro de ella, y NO pidas pasos numerados, una secuencia se muestra "
    "colocando las etapas en orden con flechas. Devuelve SOLO las secciones que califican (puede "
    "ser ninguna)."
)

classify_agent = Agent(output_type=PromptedOutput(_PlanList), system_prompt=_CLASSIFY_SYSTEM)

_cache: dict[str, list[tuple[str, GeneratedIllustration]]] = {}


def _content_text(content: object) -> str:
    if isinstance(content, TextContent):
        return content.text
    if isinstance(content, TableContent):
        return f"[tabla: {', '.join(content.columns)}]"
    if isinstance(content, ChartContent):
        return f"[gráfico {content.chart_type}]"
    if isinstance(content, TimelineContent):
        return "[línea de tiempo]"
    return ""


def _cores_digest(presentation: Presentation) -> tuple[str, str]:
    cores = [s for s in presentation.sections if s.role == "core"]
    parts = [presentation.title]
    for s in cores:
        parts.append(f"[{s.id}] {s.title or ''}: {_content_text(s.content)}".strip())
    text = "\n".join(parts)
    return text, hashlib.sha256(text.encode("utf-8")).hexdigest()


async def _classify(model: Model, presentation: Presentation) -> list[_Plan]:
    cores = [s for s in presentation.sections if s.role == "core"]
    if not cores:
        return []
    text, _ = _cores_digest(presentation)
    result = await classify_agent.run(
        f"Secciones núcleo:\n{text}\n\n¿Cuáles se benefician de una ilustración de apoyo?",
        model=model,
    )
    core_ids = {s.id for s in cores}
    seen: set[str] = set()
    plans: list[_Plan] = []
    for p in result.output.items:
        if p.section_id in core_ids and p.section_id not in seen:
            seen.add(p.section_id)
            plans.append(p)
    return plans[:_SAFETY_CAP]


_IDEOGRAM_URL = "https://api.ideogram.ai/v1/ideogram-v3/generate"

# Ideogram v3 acepta `negative_prompt` (describir qué excluir). Refuerza la opción 2 (imágenes sin
# texto): las palabras las dibujan mal y las etiquetas van en la slide. Se excluyen palabras/letras,
# NO números (excluirlos sería demasiado y una cifra natural a veces ayuda). Solo aplica a Ideogram;
# gpt-image-1 (fallback) no tiene este parámetro y depende de la instrucción del prompt.
_IDEOGRAM_NEGATIVE = (
    "texto, palabras, letras, etiquetas, leyendas, títulos, subtítulos, marcas de agua, logotipos"
)


async def _gemini_image(settings: Settings, prompt: str) -> str:
    """Genera con Gemini (PRIMARIO). Devuelve data URI. Lanza si falla.

    Pasó a ser el primario tras medirlo contra Ideogram con los mismos prompts reales: 0 de 6
    imágenes con palabras inventadas frente a 3 de 6, y además más barato ($0.067 frente a
    $0.090). No hace falta clave nueva: usa la `GOOGLE_API_KEY` que ya usan la percepción de
    audio y el fallback de estructuración.

    No tiene `negative_prompt`: toda la restricción va en el prompt, que ya la lleva delante.
    La proporción y el tamaño se fijan: sin ellos la imagen sale apaisada con bandas, y el
    tamaño es lo que clava el precio por imagen.
    """
    from google import genai
    from google.genai import types

    cliente = genai.Client(api_key=settings.google_api_key)
    respuesta = await cliente.aio.models.generate_content(
        model=settings.google_image_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            image_config=types.ImageConfig(
                aspect_ratio=settings.google_image_aspect_ratio,
                image_size=settings.google_image_size,
            ),
        ),
    )
    for parte in respuesta.candidates[0].content.parts:
        datos = getattr(parte, "inline_data", None)
        if datos and datos.data:
            crudo = datos.data if isinstance(datos.data, bytes) else base64.b64decode(datos.data)
            tipo = datos.mime_type or "image/png"
            return f"data:{tipo};base64,{base64.b64encode(crudo).decode('ascii')}"
    # Gemini filtra por seguridad con más agresividad que los otros: si rechaza el prompt no
    # devuelve imagen. Se lanza para que el respaldo tome el relevo, que es justo su razón de ser.
    raise RuntimeError("Gemini no devolvió imagen (¿filtro de seguridad?)")


#: Tope de lo que se admite descargar de un proveedor de imágenes. Una ilustración cuadrada de 1K
#: pesa menos de 2 MB; con doce hay margen de sobra para cualquier formato que devuelvan.
_MAX_IMAGEN_BYTES = 12 * 1024 * 1024

#: Sufijos que no son de internet. Los cuatro primeros los reserva la RFC 6761 para uso interno;
#: `.internal` es además el que usa la red privada de Railway entre servicios del mismo proyecto.
_SUFIJOS_RESERVADOS = (".internal", ".local", ".localhost", ".home.arpa", ".test", ".invalid")


def _url_descargable(url: str) -> str:
    """Comprueba la URL que el proveedor dice que hay que descargar. Lanza si no es admisible.

    **Es la única petición saliente del backend cuyo destino no está escrito en el código.** No la
    pone el usuario (la devuelve Ideogram en su respuesta, autenticada con nuestra clave), pero el
    servidor la busca y se trae lo que haya ahí, y eso es exactamente la forma de un SSRF.

    Tres comprobaciones cierran la clase de ataque que importa (hacer que el servidor pida una
    dirección de la red de dentro) sin atarnos a qué CDN use Ideogram mañana: tiene que ser
    `https`, el anfitrión no puede ser una IP literal (`169.254.169.254` y compañía), y no puede
    acabar en uno de los sufijos RESERVADOS, que es donde vive lo interno.

    Ese tercer punto no estaba y hacía falta: `backend.railway.internal` tiene puntos y no es una
    IP, así que pedir «un nombre de dominio con puntos» lo dejaba pasar, y es exactamente el
    vecino que tendrá este servicio cuando esté desplegado.

    Un allowlist de dominios sería más estricto, pero se rompería en silencio el día que cambien
    de CDN y nos dejaría sin ilustraciones por una medida de seguridad. Lo que se prohíbe aquí son
    nombres que ningún CDN puede usar: los reserva la RFC 6761 precisamente para esto.
    """
    partes = urlsplit(url)
    host = (partes.hostname or "").rstrip(".")
    try:
        ipaddress.ip_address(host)
    except ValueError:
        es_ip = False
    else:
        es_ip = True
    reservado = host == "localhost" or host.endswith(_SUFIJOS_RESERVADOS)
    if partes.scheme != "https" or es_ip or "." not in host or reservado:
        raise RuntimeError(f"la URL de la imagen no es descargable: {url!r}")
    return url


async def _ideogram_image(settings: Settings, prompt: str) -> str:
    """Genera con Ideogram v3 (primario). Devuelve data URI. Lanza si falla."""
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            _IDEOGRAM_URL,
            headers={"Api-Key": settings.ideogram_api_key or ""},
            files={
                "prompt": (None, prompt),
                "negative_prompt": (None, _IDEOGRAM_NEGATIVE),
                "rendering_speed": (None, settings.ideogram_rendering_speed),
                "aspect_ratio": (None, "1x1"),
                "magic_prompt": (None, "OFF"),
            },
        )
        resp.raise_for_status()
        url = _url_descargable(resp.json()["data"][0]["url"])
        # Se lee por trozos abortando al pasarse del tope, igual que las subidas del usuario
        # (`pipeline/uploads.py`): la respuesta es de un tercero, así que su tamaño no lo
        # decidimos nosotros, y una imagen enorme en un contenedor de 512 MB lo tumba.
        async with client.stream("GET", url) as img:
            img.raise_for_status()
            trozos: list[bytes] = []
            total = 0
            async for trozo in img.aiter_bytes():
                total += len(trozo)
                if total > _MAX_IMAGEN_BYTES:
                    raise RuntimeError("la imagen del proveedor excede el tope")
                trozos.append(trozo)
            ctype = img.headers.get("content-type", "image/png").split(";")[0]
        b64 = base64.b64encode(b"".join(trozos)).decode("ascii")
        return f"data:{ctype};base64,{b64}"


async def _openai_image(settings: Settings, prompt: str) -> str:
    """Genera con OpenAI gpt-image-1 (fallback). Devuelve data URI."""
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    response = await client.images.generate(
        model=settings.openai_image_model,
        prompt=prompt,
        size="1024x1024",
        quality=settings.openai_image_quality,
        n=1,
    )
    return f"data:image/png;base64,{response.data[0].b64_json}"


async def _generate_image(settings: Settings, image_prompt: str) -> str:
    """Genera la imagen como data URI. Gemini primario; Ideogram y OpenAI como respaldos.

    La restricción va DELANTE del asunto a dibujar, no detrás: se midió que enterrarla al final
    de una descripción larga la debilita.
    """
    prompt = _IMAGE_STYLE_PREFIX + image_prompt
    if settings.google_api_key:
        try:
            return await _gemini_image(settings, prompt)
        except Exception as exc:  # noqa: BLE001 (para esto existen los respaldos)
            logfire.warning("Gemini falló, probando Ideogram: {error}", error=str(exc))
    if settings.ideogram_api_key:
        try:
            return await _ideogram_image(settings, prompt)
        except Exception as exc:  # noqa: BLE001
            logfire.warning("Ideogram falló, usando gpt-image-1: {error}", error=str(exc))
    if settings.openai_api_key:
        return await _openai_image(settings, prompt)
    raise RuntimeError("No hay proveedor de imagen configurado (Gemini, Ideogram u OpenAI).")


class _Lectura(BaseModel):
    """Lo que se saca de MIRAR la imagen ya generada, no de haberla pedido."""

    util: bool = Field(
        description="¿Enseña algo que no se sepa ya leyendo el texto? False si es decorativa."
    )
    clave: str = Field(
        default="", description="UNA frase diciendo qué mirar. Vacía si `util` es false."
    )
    alt: str = Field(
        default="", description="Descripción accesible de lo que se ve. Vacía si `util` es false."
    )


_LECTURA_SYSTEM = (
    "Recibes una ilustración que acompaña a un texto, y el texto al que acompaña. La imagen la "
    "acaba de dibujar un modelo y NUNCA lleva palabras dentro, a propósito.\n"
    "Primero decide si vale la pena: pregúntate QUÉ SABE alguien después de mirarla que no "
    "supiera leyendo el texto. Si no puedes nombrar algo concreto (el aspecto de una cosa, un "
    "tamaño relativo, una disposición en el espacio, un orden), entonces es decorativa: pon "
    "`util` en false y no escribas nada más. Ser bonita no cuenta. Estar relacionada con el tema "
    "tampoco.\n"
    "Si sí vale, escribe la `clave`: UNA frase que diga qué mirar, nombrando lo que se ve con el "
    "vocabulario del texto. Por ejemplo, de qué es cada color o cada forma. NO repitas lo que el "
    "texto ya dice, y NO menciones nada que no esté dibujado en la imagen que tienes delante: "
    "describe esta imagen, no la que se pidió.\n"
    "Y escribe el `alt`: qué se ve, para quien no puede verla. Frase llana, sin «imagen de».\n"
    "Responde en el idioma del texto."
)

lectura_agent = Agent(output_type=PromptedOutput(_Lectura), system_prompt=_LECTURA_SYSTEM)


def _partes_de_data_uri(data_uri: str) -> tuple[bytes, str]:
    """Separa un `data:` en (bytes, media type). Lanza si no tiene la forma esperada."""
    cabecera, _, datos = data_uri.partition(",")
    if not datos or not cabecera.startswith("data:") or ";base64" not in cabecera:
        raise ValueError("la imagen no viene como data URI en base64")
    return base64.b64decode(datos), cabecera[len("data:") : cabecera.index(";")]


async def leer_ilustracion(
    model: Model, data_uri: str, contexto: str
) -> GeneratedIllustration | None:
    """Monta la ilustración MIRANDO la imagen. Devuelve None si no aporta nada.

    Hay dos razones para pasar por aquí en vez de escribir la clave cuando se pide la imagen.

    La primera es que una clave escrita antes describiría lo que se ENCARGÓ, no lo que salió, y si
    el dibujante entiende otra cosa la clave miente. Una clave equivocada es peor que ninguna, es
    el mismo argumento con el que se prohibieron las marcas sin leyenda dentro de la imagen.

    La segunda es que mirarla permite tirarla. Hasta ahora, una ilustración genérica se publicaba
    igual porque nadie la revisaba; el único filtro estaba ANTES, decidiendo si el tema pedía
    imagen. Ahora el filtro está también DESPUÉS, sobre la imagen concreta, que es donde se puede
    comprobar de verdad si aporta algo.

    Si la lectura falla (red, filtro del proveedor), la imagen se queda sin clave pero se publica:
    es lo que había antes de este cambio, y no justifica perder una imagen ya pagada.
    """
    try:
        datos, media_type = _partes_de_data_uri(data_uri)
        resultado = await lectura_agent.run(
            [
                f"Texto al que acompaña:\n{contexto}",
                BinaryContent(data=datos, media_type=media_type),
                "¿Aporta algo esta imagen? Si sí, dame la clave y el alt.",
            ],
            model=model,
        )
    except Exception:  # noqa: BLE001 (la lectura es una mejora, no un requisito)
        logfire.exception("ilustración: no se pudo leer la imagen generada")
        return GeneratedIllustration(image_url=data_uri, alt=f"Ilustración sobre: {contexto[:80]}")

    lectura = resultado.output
    if not lectura.util:
        logfire.info("ilustración descartada por decorativa: {ctx}", ctx=contexto[:80])
        return None
    return GeneratedIllustration(
        image_url=data_uri,
        alt=lectura.alt or f"Ilustración sobre: {contexto[:80]}",
        clave=lectura.clave or None,
    )


async def illustrate(
    model: Model, settings: Settings, presentation: Presentation
) -> list[tuple[str, GeneratedIllustration]]:
    """Clasifica + genera ilustraciones para los núcleos que califican. Cacheado por documento."""
    _text, key = _cores_digest(presentation)
    if key in _cache:
        return _cache[key]
    if not has_image_provider(settings):
        raise RuntimeError(
            "Sin proveedor de imagen (IDEOGRAM_API_KEY u OPENAI_API_KEY): ilustraciones "
            "no disponibles."
        )

    plans = await _classify(model, presentation)
    by_id = {s.id: s for s in presentation.sections}
    out: list[tuple[str, GeneratedIllustration]] = []
    for plan in plans:
        data_uri = await _generate_image(settings, plan.image_prompt)
        section = by_id[plan.section_id]
        contexto = f"{section.title or ''}: {_content_text(section.content)}".strip(": ")
        ilustracion = await leer_ilustracion(model, data_uri, contexto)
        # `None` = la lectura la descartó por decorativa. La sección se queda sin imagen, que es
        # mejor que una que no dice nada.
        if ilustracion is not None:
            out.append((plan.section_id, ilustracion))
    _cache[key] = out
    return out
