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

Construcción **por hitos** (ver `PROYECTO.md` §7 y `docs/Registro_de_Hitos.md`). Estado:

- **Hitos 0–7 ✅ completos:** andamiaje (0), contrato de datos tipado (1), pipeline de 3 fases
  (2), frontend con Stable Core Pattern (3), entrada multimodal binaria (4), identidad visual +
  isomorfismo + modos resumen/detallado + atribución interactiva + streaming + layout (5a–5e),
  consolidación con modelo real (5f), **chat anclado a fuentes** (6) y el experimento
  **RAG vectorial vs GraphRAG** (7, estudio aparte del producto).
- **Capa de dinamismo (5g–5k):** adelanto al cargar, narración por voz, ilustraciones generadas,
  vista y generación de diapositivas, entrada por voz en el chat y rediseño visual completo.
- **Audio como formato de ENTRADA ✅:** un audio se transforma en presentación igual que un PDF.
  Como el motor de estructuración no admite audio, una **fase de percepción** previa (Gemini) lo
  convierte en una representación estructurada con hablantes, énfasis, pausas y condiciones
  acústicas — **no** una transcripción plana. El chat, el adelanto, las preguntas sugeridas y las
  diapositivas funcionan también sobre audio.
- **Verificado con el modelo real (Hito 5f):** el PDF multimodal nativo recupera datos de
  gráficos **rasterizados** que un extractor de texto pierde; el juez de coherencia semántica
  marca cifras alteradas y afirmaciones no respaldadas; los fallos surfacean un error visible
  (nunca una presentación que parezca terminada). El **fallback** del modelo (Gemini) está
  implementado pero **no** ejercitado de punta a punta; las afirmaciones sobre él son de diseño.

**Pendiente:** la evaluación con usuarios (Hito 8 Parte B). La telemetría de comportamiento
(Parte A) y el endurecimiento del grounding (A.1) ya están hechos.

## Estructura del repositorio

```
multimodal_presenter/
├── PROYECTO.md            # Contexto maestro del sistema
├── docs/                  # Diseño, decisiones y Registro_de_Hitos.md (trazabilidad)
├── backend/               # API Python (FastAPI + PydanticAI) — gestionada con uv
│   ├── src/multimodal_presenter/
│   │   ├── main.py        #   app FastAPI + health check
│   │   ├── config.py      #   settings tipadas (lee .env)
│   │   ├── model_provider.py  # Anthropic primario + fallback Gemini + percepción de audio
│   │   ├── schemas/       #   contrato de datos tipado (Hito 1)
│   │   ├── pipeline/      #   Fase 1 extracción · Fase 2 estructuración · Fase 3 validación + streaming
│   │   └── api/routes.py  #   POST /transform y /transform/stream (SSE)
│   ├── scripts/           #   arnés de métricas con modelo real (Hito 5f, fuera de producción)
│   └── tests/             #   unitarios + integración (modelo real, -m integration)
└── frontend/              # Next.js 16 + Tailwind v4 (App Router)
    ├── app/               #   página, layout, API route del SSE
    ├── components/        #   AppShell + Workspace (columnas) + render por tipo
    └── lib/               #   contrato TS + detail (5b) + highlight (5c) + workspace (5e)
```

> **Composición interna de una sección (Escala 1 del layout, Hito 5e):** es **spec documentada,
> no cableada**. El contrato define `Section.content` como **un solo** bloque, así que una
> sección no combina varios tipos hoy; las reglas de composición interna se activarían solo si
> el contrato admitiera secciones multi-contenido. Ver `frontend/lib/workspace.ts`.

## Stack

- **Backend:** Python 3.12 · FastAPI · PydanticAI · gestionado con [uv](https://docs.astral.sh/uv/)
- **Modelo:** Anthropic **claude-sonnet-5** (primario, multimodal nativo, salida estructurada por
  `PromptedOutput`) + **Gemini directo** como fallback opcional (`FallbackModel`). El pipeline es
  agnóstico al modelo (se inyecta). *(Hasta 2026-10-02 el fallback se alcanzaba a través de
  OpenRouter; al haber clave propia de Google, el intermediario sobraba y salió del proyecto.)*
- **Percepción de audio:** Gemini con entrada acústica nativa, en una fase previa y **aislada**
  del motor de estructuración, y **sin fallback** a propósito: un cambio silencioso de modelo
  alteraría la calidad de la anotación, que es justo lo que mide la evaluación de esa pieza.
- **Observabilidad:** [Pydantic Logfire](https://logfire.pydantic.dev/)
- **Frontend:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Recharts

## Cómo levantarlo (backend)

Requiere [uv](https://docs.astral.sh/uv/) instalado. Desde `backend/`:

```bash
cd backend
uv sync                       # crea el entorno e instala dependencias (descarga Python 3.12)
cp .env.example .env          # rellena ANTHROPIC_API_KEY (obligatoria para el pipeline)
uv run uvicorn multimodal_presenter.main:app --reload
```

`ANTHROPIC_API_KEY` es obligatoria para transformar; `OPENROUTER_API_KEY` es opcional (activa el
fallback). Sin claves, los tests siguen corriendo porque inyectan un modelo mock.

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
uv run pytest                 # tests (unitarios; los de integración se saltan)
uv run pytest -m integration  # tests con el modelo REAL (solo local, requiere clave)
```

### Frontend

Desde `frontend/` (requiere Node): `npm install`, luego `npm run dev` (queda en
`http://localhost:3000` y hace proxy de `/api/*` al backend). `npm test` corre los tests con
vitest; `npm run build` y `npm run lint` para verificar.

## Secretos

Las claves de API van **siempre** en `backend/.env` (gitignoreado desde el primer
commit). `backend/.env.example` documenta las variables con placeholders. Nunca se
commitea un secreto real.

## Flujo de trabajo (git)

Git-flow local: `main` (estable) ← `develop` (integración) ← `feature/hito-N-*`
(una rama por hito). Commits convencionales y atómicos para trazabilidad completa.
