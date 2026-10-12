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
├── docker-compose.yml     # La aplicación entera, igual que corre desplegada
├── docs/                  # Diseño, decisiones y Registro_de_Hitos.md (trazabilidad)
├── backend/               # API Python (FastAPI + PydanticAI) — gestionada con uv
│   ├── Dockerfile         #   imagen de producción (sin privilegios, con volumen)
│   ├── entrypoint.sh      #   ajusta el dueño del volumen y baja privilegios
│   ├── src/multimodal_presenter/
│   │   ├── main.py        #   app FastAPI + health check
│   │   ├── config.py      #   settings tipadas (lee .env)
│   │   ├── model_provider.py  # Anthropic primario + fallback Gemini + percepción de audio
│   │   ├── schemas/       #   contrato de datos tipado (Hito 1)
│   │   ├── pipeline/      #   Fase 1 extracción · Fase 2 estructuración · Fase 3 validación + streaming
│   │   ├── storage/       #   SQLite + documentos en disco + migraciones numeradas
│   │   └── api/           #   routes.py (pipeline) · auth.py · library.py · limites.py (topes)
│   ├── scripts/           #   arnés de métricas, exportador de telemetría, respaldo de la base
│   └── tests/             #   unitarios + integración (modelo real, -m integration)
└── frontend/              # Next.js 16 + Tailwind v4 (App Router)
    ├── Dockerfile         #   imagen de producción (salida standalone)
    ├── proxy.ts           #   portón de acceso + política de contenido (corre antes que todo)
    ├── app/               #   páginas, layout, route handlers del SSE, /acceso
    ├── components/        #   AppShell + Workspace (columnas) + render por tipo
    └── lib/               #   contrato TS + detail (5b) + highlight (5c) + acceso + csp
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

`ANTHROPIC_API_KEY` es obligatoria para transformar. `GOOGLE_API_KEY` es opcional para texto, PDF e
imagen (activa el fallback de estructuración) y **obligatoria para audio**. Sin claves, los tests
siguen corriendo porque inyectan un modelo mock.

Dos variables que conviene conocer aunque tengan valor por defecto: **`REGISTRO_ABIERTO` viene en
`false`**, así que para crearte una cuenta en tu máquina hay que ponerla en `true`; y
`TELEMETRIA_TOKEN`, sin la cual el endpoint de volcado no existe. Las demás están explicadas una a
una en `.env.example`.

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
vitest; `npm run build`, `npm run lint` y `npx tsc --noEmit` para verificar. El frontend **no está
en el CI**, así que esos tres se corren a mano.

Sus variables están en `frontend/.env.example` y en desarrollo normal no hace falta ninguna.

## Despliegue

La aplicación son **dos piezas y un volumen**. El navegador habla solo con el frontend, que
reenvía `/api/*` al backend por una red privada; el backend no tiene dominio propio. Un solo
origen, así que no hay CORS ni cookies de terceros.

Para levantarlo entero igual que corre desplegado:

```bash
docker compose up -d --build        # queda en http://localhost:3000
docker compose down                 # para (el volumen SOBREVIVE)
docker compose down -v              # para y borra los datos
```

Todo lo que hay que conservar vive en el volumen: la base SQLite, los documentos subidos, las
narraciones y los JSONL de telemetría. Las dos variables que lo fijan (`DATA_DIR` y
`TELEMETRY_DIR`) van explícitas, porque su valor por defecto cae en el home del usuario, que en un
contenedor es efímero.

Tres cosas que no son obvias y cuestan una tarde si se descubren tarde:

- **`BACKEND_URL` se lee al COMPILAR**, no al arrancar: Next congela el destino de los `rewrites`
  dentro del build. Va como argumento de construcción. `ACCESO_CODIGO` y las del backend, en
  cambio, son de ejecución.
- **Uvicorn escuchando en `::` crea un socket solo de IPv6.** Es lo correcto donde la red privada
  es IPv6, y por eso la red de compose también lo es.
- **El volumen se monta a nombre de root**, así que el contenedor arranca como root solo para
  ajustar el dueño y baja a un usuario sin privilegios antes de servir (`entrypoint.sh`).

Defensas que se activan **solo si se configuran**, de modo que el desarrollo local no cambia:
`ACCESO_CODIGO` (portón delante de todo, también de `/api/*`), `REGISTRO_ABIERTO`,
`TELEMETRIA_TOKEN` y los topes `LIMITE_*`. Están explicadas una a una en los dos `.env.example`.

Para bajar la telemetría del despliegue y sacar los CSV:

```bash
cd backend
TELEMETRIA_TOKEN=... uv run python scripts/bajar_telemetria.py --url https://<la-url>
```

Y para respaldar la base **sin copiarla en caliente** (usa `VACUUM INTO`, que espera a un punto
coherente; con WAL, un `cp` puede dar una copia que abre y ha perdido lo último). Se lanza **dentro
del contenedor**, que es donde está la base:

```bash
docker compose exec api python /app/scripts/respaldar_base.py --destino /datos/respaldos --mantener 7
```

Deja la copia en el propio volumen, a propósito: así la copia programada del volumen se lleva un
respaldo ya consistente en vez de una foto del archivo vivo. Es lo que convierte «hay copias» en
«hay copias que sirven».

## Secretos

Las claves de API van **siempre** en `backend/.env` (gitignoreado desde el primer
commit). `backend/.env.example` documenta las variables con placeholders, y
`frontend/.env.example` las del frontend. Nunca se commitea un secreto real, y los `.dockerignore`
los dejan fuera de las imágenes además de fuera de git: son dos listas distintas y cada una decide
una cosa.

## Flujo de trabajo (git)

Git-flow local: `main` (estable) ← `develop` (integración) ← `feature/hito-N-*`
(una rama por hito). Commits convencionales y atómicos para trazabilidad completa.

**Desde el despliegue, `main` significa una cosa más: lo que está publicado.** El despliegue
observa esa rama, así que un merge a `main` pasa a ser un acto de publicación y no solo de
integración; lo que se quede en `develop` no está en internet. Durante las sesiones de evaluación
los autodespliegues se desactivan, para que un merge no pueda cambiar lo que un participante está
usando en ese momento.
