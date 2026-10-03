"""Puntúa la batería: ¿cuánto texto no deseado hay en cada imagen?

Se puntúa con un modelo de visión en vez de a ojo para que el conteo sea reproducible y quede
registrado por qué se contó cada una. Las conclusiones se verifican después mirando una muestra:
el juez es una ayuda para contar 18 imágenes, no la autoridad final.
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

from pydantic import BaseModel, Field
from pydantic_ai import Agent, BinaryContent, ToolOutput

from multimodal_presenter.config import get_settings
from multimodal_presenter.model_provider import build_summary_model

SALIDA = Path(__file__).resolve().parent / "outputs" / "texto_en_imagenes"


class Veredicto(BaseModel):
    hay_texto: bool = Field(description="¿Aparece CUALQUIER carácter escrito en la imagen?")
    cuantas_palabras: int = Field(ge=0, description="Cuántas palabras o grupos de letras se ven")
    con_errores: bool = Field(
        description="¿Alguna de esas palabras está mal escrita o es ilegible?"
    )
    ejemplos: list[str] = Field(default_factory=list, description="Hasta 4 ejemplos literales")


juez = Agent(
    output_type=ToolOutput(Veredicto),
    system_prompt=(
        "Examinas una ilustración generada por IA. La regla del sistema es que la imagen NO debe "
        "contener NINGÚN texto escrito: ni palabras, ni etiquetas, ni títulos, ni leyendas. "
        "La regla es más estricta que 'sin texto': la imagen debe entenderse SOLA, así que "
        "tampoco puede llevar marcas que remitan a una leyenda que no existe — numeración de "
        "pasos como (1) (2) (3), letras clave, o líneas guía que apuntan a un hueco. Cuenta esas "
        "marcas igual que el texto. Las flechas de dirección, los símbolos de carga (+, -) y los "
        "colores NO cuentan: se entienden sin clave. Sé literal: transcribe lo que de verdad se ve."
    ),
)


async def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    modelo = build_summary_model(get_settings())
    resultados: dict[str, dict] = {}
    for png in sorted(SALIDA.glob("*.png")):
        datos = png.read_bytes()
        # El proveedor no siempre devuelve lo que dice la extensión: Ideogram entrega JPEG. Se
        # mira la firma real del archivo, porque la API de visión rechaza el tipo equivocado.
        tipo = "image/jpeg" if datos[:3] == bytes((0xFF, 0xD8, 0xFF)) else "image/png"
        r = await juez.run(
            [
                "¿Contiene esta imagen texto escrito?",
                BinaryContent(data=datos, media_type=tipo),
            ],
            model=modelo,
        )
        resultados[png.stem] = r.output.model_dump()
        v = r.output
        marca = "CON TEXTO" if v.hay_texto else "limpia   "
        print(f"{png.stem:<28} {marca}  palabras={v.cuantas_palabras:<3} typos={v.con_errores}")
        if v.ejemplos:
            print(f"    {', '.join(v.ejemplos[:4])!r}")
    (SALIDA / "veredictos.json").write_text(
        json.dumps(resultados, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print("\n── Resumen ──")
    for tanda in ("ideogram_A", "ideogram_B", "gemini_B", "gemini_C"):
        de_la_tanda = {k: v for k, v in resultados.items() if k.startswith(tanda + "__")}
        con = sum(1 for v in de_la_tanda.values() if v["hay_texto"])
        print(f"{tanda:<12} con texto: {con}/{len(de_la_tanda)}")


if __name__ == "__main__":
    asyncio.run(main())
