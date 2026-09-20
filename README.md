# Multimodal Presenter

Prototipo de trabajo de grado (Ingeniería de Sistemas — Universidad del Valle).

Aplicación que recibe información multimodal (texto, PDF, imagen y, a futuro, audio)
y la transforma en **presentaciones estructuradas e interactivas**, con el objetivo
de **reducir la carga cognitiva** del usuario. Su propuesta de valor diferencial
frente a herramientas como NotebookLM es ser más **abierto, verificable y trazable**:
cada afirmación presentada puede rastrearse a su origen en el documento fuente.

> **Naturaleza del proyecto:** prototipo exploratorio de validación técnica y
> conceptual, **no** un producto de producción. El contexto completo del sistema, la
> arquitectura por capas y el principio rector de diseño están en
> [`PROYECTO.md`](PROYECTO.md); las decisiones de diseño, en [`docs/`](docs/).

## Estado actual

Construcción **por hitos** (ver `PROYECTO.md` §7). Lo que existe hoy:

- **Hito 0 — Andamiaje del repo** ✅ estructura, manejo de secretos, Logfire y CI.
- **Hito 1 — Contrato de datos tipado** 🚧 en curso.

El resto de hitos (pipeline, frontend, multimodal, etc.) aún no está implementado.

## Estructura del repositorio

```
multimodal_presenter/
├── PROYECTO.md            # Contexto maestro del sistema
├── docs/                  # Documentos de diseño y decisiones (Fase 1 y 2)
├── backend/               # API Python (FastAPI + PydanticAI) — gestionada con uv
│   ├── src/multimodal_presenter/
│   │   ├── main.py        #   app FastAPI + health check
│   │   ├── config.py      #   settings tipadas (lee .env)
│   │   ├── observability.py  # integración con Logfire
│   │   └── schemas/       #   contrato de datos tipado (Hito 1)
│   └── tests/
└── frontend/              # Next.js + Tailwind (reservado — Hito 3)
```

## Stack

- **Backend:** Python 3.12 · FastAPI · PydanticAI (Hito 2+) · gestionado con [uv](https://docs.astral.sh/uv/)
- **Modelo:** Google Gemini (multimodal nativo) — se conecta en el Hito 2
- **Observabilidad:** [Pydantic Logfire](https://logfire.pydantic.dev/)
- **Frontend:** Next.js + Tailwind (Hito 3)

## Cómo levantarlo (backend)

Requiere [uv](https://docs.astral.sh/uv/) instalado. Desde `backend/`:

```bash
cd backend
uv sync                       # crea el entorno e instala dependencias (descarga Python 3.12)
cp .env.example .env          # y rellena tus claves reales (opcional en Hito 0/1)
uv run uvicorn multimodal_presenter.main:app --reload
```

La API queda en `http://127.0.0.1:8000`. Verifica el health check:

```bash
curl http://127.0.0.1:8000/health
# {"status":"ok","service":"multimodal-presenter-backend","environment":"development"}
```

Documentación interactiva de la API en `http://127.0.0.1:8000/docs`.

### Verificar la observabilidad (Logfire)

Sin `LOGFIRE_TOKEN`, las trazas se imprimen en consola (útil para verificar sin
enviar nada al dashboard). Al golpear `/health` verás la jerarquía de spans:

```
GET /health
  health_check
    health check solicitado
```

Para enviarlas al dashboard de Logfire, coloca tu `LOGFIRE_TOKEN` en `.env`.

## Desarrollo

Desde `backend/`:

```bash
uv run ruff check .           # linter
uv run ruff format .          # formateo
uv run pytest                 # tests
```

## Secretos

Las claves de API van **siempre** en `backend/.env` (gitignoreado desde el primer
commit). `backend/.env.example` documenta las variables con placeholders. Nunca se
commitea un secreto real.

## Flujo de trabajo (git)

Git-flow local: `main` (estable) ← `develop` (integración) ← `feature/hito-N-*`
(una rama por hito). Commits convencionales y atómicos para trazabilidad completa.
