# Multimodal Presenter

Aplicación web que transforma un documento en una presentación estructurada e interactiva, y
deja volver a la fuente de cada afirmación. Trabajo de grado de Ingeniería de Sistemas en la
Universidad del Valle.

Recibe texto, PDF, imágenes y audio. El documento llega al modelo en su forma original, sin
convertirlo antes a texto plano, y sale organizado en secciones de cuatro tipos (texto, tabla,
línea de tiempo y gráfico) con dos niveles de lectura: uno resumido con lo esencial y otro
detallado con el contenido de apoyo.

## Qué hace

- **Camino de vuelta a la fuente.** Cada sección trae la frase del original de la que sale. Al
  pulsarla se abre el documento con el pasaje señalado, y la interfaz declara qué tan preciso es
  ese señalamiento: fragmento exacto en texto plano, recuadro sobre la frase en un PDF con capa de
  texto, página completa en escaneados e imágenes, y el segundo exacto en audio. Localizar no es
  verificar, y el sistema no presenta un nivel como si fuera otro.
- **Chat sobre el documento.** Relee el documento completo en cada pregunta y ancla cada
  respuesta a su cita, validada con el mismo mecanismo de las secciones. Sugiere preguntas y
  admite dictarlas por voz.
- **Audio como fuente.** Una fase de percepción previa distingue quién dijo qué, y cada idea queda
  atribuida a su hablante. La fuente de una sección abre la transcripción con la cita resaltada y
  el audio en ese segundo.
- **Narración y diapositivas.** Una narración en audio escrita para el oído y una presentación en
  diapositivas con guion propio, donde las láminas que simplifican se marcan como síntesis.
- **Biblioteca.** Con una cuenta se guarda la presentación con su documento y su conversación.
  Todo lo demás funciona sin cuenta.

## Stack

- **Backend:** Python 3.12, FastAPI y PydanticAI, gestionado con [uv](https://docs.astral.sh/uv/).
  SQLite con migraciones numeradas para la biblioteca.
- **Modelos:** Anthropic `claude-sonnet-5` para la estructuración, con Gemini como respaldo
  (`FallbackModel`); Gemini con entrada acústica para la percepción de audio. El flujo no depende
  del proveedor: el modelo se inyecta.
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4 y Recharts. Las
  secciones llegan al navegador por eventos del servidor (SSE) a medida que se generan.
- **Observabilidad:** [Pydantic Logfire](https://logfire.pydantic.dev/).

## Estructura

```
multimodal_presenter/
├── docker-compose.yml     # la aplicación entera, igual que corre desplegada
├── backend/
│   ├── src/multimodal_presenter/
│   │   ├── schemas/       # contrato de datos tipado
│   │   ├── pipeline/      # extracción, estructuración, validación y anclaje a fuentes
│   │   ├── storage/       # SQLite y documentos en disco
│   │   └── api/           # rutas, cuentas, biblioteca y topes de uso
│   ├── scripts/           # exportador de telemetría y respaldo de la base
│   ├── experiments/       # comparación de lectura directa frente a recuperación
│   └── tests/
└── frontend/
    ├── proxy.ts           # política de contenido por petición
    ├── app/               # páginas, layout y manejadores del SSE
    ├── components/
    └── lib/               # contrato en TypeScript y lógica de presentación
```

## Cómo levantarlo

### Backend

Requiere [uv](https://docs.astral.sh/uv/). Desde `backend/`:

```bash
uv sync
cp .env.example .env          # rellena ANTHROPIC_API_KEY
uv run uvicorn multimodal_presenter.main:app --reload
```

`ANTHROPIC_API_KEY` es obligatoria para transformar. `GOOGLE_API_KEY` activa el respaldo de
estructuración y es obligatoria para aceptar audio. Para crear cuentas en local, pon
`REGISTRO_ABIERTO=true`. Todas las variables están explicadas en `backend/.env.example`.

La API queda en `http://127.0.0.1:8000`, con documentación interactiva en `/docs`.

### Frontend

Requiere Node 24. Desde `frontend/`:

```bash
npm install
npm run dev                   # http://localhost:3000, reenvía /api/* al backend
```

En desarrollo no hace falta ninguna variable; las opcionales están en `frontend/.env.example`.

### Todo junto

```bash
docker compose up -d --build  # http://localhost:3000
docker compose down           # el volumen con los datos se conserva
```

## Pruebas

```bash
# backend/
uv run ruff check .
uv run pytest                 # unitarias, sin claves: el modelo se sustituye
uv run pytest -m integration  # con el modelo real, requiere claves

# frontend/
npm run lint
npx tsc --noEmit
npm test
```

La integración continua corre el lint, la comprobación de tipos y las pruebas de las dos partes
en cada cambio, sin claves reales.

## Despliegue

Son dos servicios y un volumen. El navegador habla solo con el frontend, que reenvía `/api/*` al
backend por una red privada; el backend no tiene dominio público. Un solo origen, así que no hay
CORS ni cookies de terceros.

Tres detalles que conviene saber:

- `BACKEND_URL` se lee al compilar: Next fija el destino de los `rewrites` dentro del build, así
  que va como argumento de construcción.
- El volumen se monta a nombre de root, así que el contenedor ajusta el dueño al arrancar y baja a
  un usuario sin privilegios antes de servir (`entrypoint.sh`).
- La base, los documentos, las narraciones y la telemetría viven en el volumen. `DATA_DIR` y
  `TELEMETRY_DIR` van explícitas porque su valor por defecto cae en el home, que en un contenedor
  es efímero.

Los topes de uso por hora (`LIMITE_*`), el registro de cuentas (`REGISTRO_ABIERTO`) y el volcado
de telemetría (`TELEMETRIA_TOKEN`) se configuran con variables de entorno.

Para respaldar la base sin copiarla en caliente:

```bash
docker compose exec api python /app/scripts/respaldar_base.py --destino /datos/respaldos --mantener 7
```

## Licencia

[MIT](LICENSE).
