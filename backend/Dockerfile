# syntax=docker/dockerfile:1

# Imagen del backend.
#
# `python:3.12-slim` pelada: ninguna dependencia de este proyecto necesita compilar nada ni pide
# una biblioteca del sistema. `pypdfium2` —el motor de PDF— trae rueda manylinux, igual que
# `argon2-cffi` y `mutagen`. Lo único que se instala con apt es `gosu`, y no es una dependencia
# del programa sino de cómo arranca (ver `entrypoint.sh`).
#
# Dos etapas: la primera resuelve el entorno y la segunda se queda solo con él. Así `uv` y el
# código fuente no viajan en la imagen final.

# ─────────────────────────────── 1. entorno ───────────────────────────────
FROM python:3.12-slim AS entorno

# `uv` fijado por versión, la misma que uso en mi máquina. Una imagen que se construye distinta
# cada semana no es reproducible, y entonces «funciona en Railway» no significa nada.
COPY --from=ghcr.io/astral-sh/uv:0.9.18 /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app

# Primero el manifiesto y nada más. Así la capa de dependencias —la lenta— se reaprovecha mientras
# no cambien, que es casi siempre: tocar código no vuelve a resolver 80 paquetes.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Y ahora el proyecto. `--no-editable` lo instala de verdad dentro del entorno, así que la imagen
# final no necesita el código fuente al lado: las migraciones `.sql` viajan dentro del paquete.
COPY src/ src/
RUN uv sync --frozen --no-dev --no-editable

# ──────────────────────────────── 2. servir ────────────────────────────────
FROM python:3.12-slim AS final

RUN apt-get update \
    && apt-get install --no-install-recommends --yes gosu \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 app

WORKDIR /app
COPY --from=entorno /app/.venv /app/.venv

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    # El volumen. Las dos variables van explícitas porque su valor por defecto cae en el home del
    # usuario, que aquí es efímero: un redespliegue se llevaría las cuentas, la biblioteca y —lo
    # que de verdad no se puede repetir— la telemetría de una sesión.
    DATA_DIR=/datos/base \
    TELEMETRY_DIR=/datos/telemetria \
    # Sin esto la cookie de sesión viaja sin `Secure`.
    ENVIRONMENT=production

# El `chmod` va aquí y no se da por supuesto: el repositorio se edita desde Windows, que no
# guarda el bit de ejecución, así que el archivo llega sin él.
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

# `::` y no `0.0.0.0`: la red privada de Railway resuelve a IPv6 en los entornos antiguos y a las
# dos pilas en los nuevos, y escuchar en `::` cubre los dos casos. Escuchando solo en IPv4, el
# frontend no encuentra al backend y el fallo parece de DNS.
#
# `--no-server-header` para no anunciar con qué está hecho esto: se colaba hasta el navegador por
# el reenvío de `/api/*`.
CMD ["sh", "-c", "exec uvicorn multimodal_presenter.main:app --host :: --port ${PORT:-8000} --no-server-header"]
