# Inventario curado de herramientas para un sistema de IA multimodal (2026)

> **Nota de vigencia (2026-10-02).** Este documento es el **diagnóstico de la Fase 1**: una foto
> del mercado de herramientas en su momento, no una descripción de lo que el sistema usa. Se
> conserva tal cual porque es la evidencia de que la elección fue informada. Lo finalmente
> adoptado está en `README.md` y en `docs/Registro_de_Hitos.md`, y **diverge a propósito** en
> varios puntos:
>
> | Recomendación de la Fase 1 | Qué se hizo | Por qué |
> |---|---|---|
> | **Logfire** (observabilidad) | **Adoptado** desde el Hito 0 | Tal cual se recomendó |
> | **Docling / anydoc** (parseo) | **Descartado** | Convierten el documento a Markdown/texto: eso **aplana** justo la información (tablas, diagramas, layout) que un modelo multimodal sabe leer. El PDF llega al modelo como binario nativo (Hito 4) |
> | **OpenRouter / LiteLLM** (gateway) | **Usado y luego retirado** | Sirvió como fallback mientras no había clave propia de Google; al haberla, el intermediario dejó de aportar (2026-10-02) |
> | **pgvector / Qdrant** (RAG) | **No adoptado en producción** | El experimento del Hito 7 concluyó que a escala de documento el baseline con *prompt caching* gana en exactitud. El RAG vectorial del experimento se hizo con coseno en NumPy, sin base de datos vectorial |
> | **LightRAG** (GraphRAG) | **Usado solo en el experimento** | Como estaba previsto: estudio aparte, no producto |
> | **Vercel AI SDK / Thesys C1 / CopilotKit-AG-UI** (Generative UI) | **Descartado** | Se hizo SSE propio con grano por `Section` (Hito 5d). La Generative UI se renderiza desde el contrato tipado, sin librería intermedia |

## TL;DR
- **AnyDoc y OmniRoute SON reales y vigentes**, pero cuidado con los homónimos: "anydoc" es la librería open source de Firecrawl (Rust, release inicial agosto 2026) para convertir Office/PDF a Markdown, y "OmniRoute" es un gateway LLM open source MIT (diegosouzapw) local-first. Ambos nombres tienen clones/homónimos comerciales que NO son lo mismo (verifica los repos oficiales).
- Para tu stack (FastAPI + PydanticAI + Next.js Generative UI) las apuestas más fuertes con capa gratuita generosa son: **Docling** (parseo), **Pydantic Logfire** (observabilidad, integración nativa con PydanticAI), **OpenRouter/LiteLLM** (gateway), **pgvector + Qdrant** (RAG vectorial) y **Vercel AI SDK / Thesys C1 / CopilotKit-AG-UI** (Generative UI).
- Para la comparación GraphRAG, empieza con **LightRAG** (calidad comparable a Microsoft GraphRAG a una fracción ínfima del coste de indexado); reserva Microsoft GraphRAG para consultas globales que cruzan documentos, y Graphiti para memoria de agente temporal.

## Key Findings
- Los dos nombres que querías verificar (AnyDoc, OmniRoute) existen y están activos, pero requieren desambiguación cuidadosa por homónimos comerciales.
- El ecosistema de parseo documental en 2026 se ha consolidado en tres open source serios (Docling, Marker, MinerU) más APIs cloud baratas (Mistral OCR a $1–4/1000 pág; Reducto r-1 a 1¢/página).
- **Logfire es la mejor opción de observabilidad para tu stack** por ser del mismo equipo que PydanticAI, con integración nativa y OpenTelemetry.
- El mercado de gateways LLM se divide claramente entre hosted (OpenRouter), self-hosted OSS (LiteLLM) y observability-first (Portkey); OmniRoute es un cuarto tipo: local-first para herramientas de coding.
- Movimientos de consolidación relevantes: Langfuse fue adquirida por ClickHouse (enero 2026) y Arize está en proceso de adquisición por Dynatrace por $915M (agosto 2026).

## Details

### CATEGORÍA 1 ( PARSEO Y EXTRACCIÓN DE DOCUMENTOS MULTIMODALES

**anydoc (Firecrawl) ) VERIFICACIÓN PRIORITARIA ✅ REAL Y VIGENTE**
- Qué hace: librería open source en Rust (con bindings Node.js y Python) que convierte 14 formatos (Word, PowerPoint, Excel, OpenDocument, RTF, EPUB, CSV, PDF) a GitHub-Flavored Markdown limpio "en milisegundos" (mediana ~4,7 ms vs 1129 ms de LibreOffice en su benchmark). Detección de formato por contenido, no por extensión. Publicado como Agent Skill para Claude Code/Codex/Cursor.
- Encaje en tu stack: excelente como pre-procesador rápido en tu backend Python para documentos de texto (Word, PPT, Excel). ⚠️ Su soporte de PDF es solo para PDFs con texto embebido, NO hace OCR de escaneados (para eso usa la Parse API hospedada de Firecrawl con sus modelos OCR).
- Precio: open source gratuito. La Parse API hospedada de Firecrawl es de pago.
- Vigencia: VIGENTE (release inicial agosto 2026). ⚠️ Existen varios homónimos comerciales SIN relación: "AnyDocsAI.com", "AnyDoc Online" (anydoc.online), "AnythingMD", "AnyDocTranslator". El producto real que probablemente escuchaste es el de Firecrawl (**github.com/firecrawl/anydoc**).

**Docling (IBM Research)**
- Qué hace: toolkit open source de conversión de documentos (PDF, DOCX, PPTX, XLSX, HTML, EPUB, imágenes, audio) a Markdown/JSON estructurado con comprensión avanzada de layout, orden de lectura, tablas (TableFormer), fórmulas. Usa el VLM Granite-Docling de IBM.
- Encaje: MUY bueno. Python nativo, corre local (CPU), integra con LlamaIndex/LangChain, y su `DoclingDocument` tipado (usa Pydantic v2) encaja con tu filosofía. Ideal para documentos complejos con tablas/diagramas.
- Precio: 100% open source, licencia MIT. Solo pagas tu infraestructura.
- Vigencia: MUY VIGENTE. Proyecto bajo LF AI & Data Foundation.

**LlamaParse (LlamaIndex)**
- Qué hace: servicio de parseo GenAI-native para documentos complejos, con tiers (Fast, Cost-effective, Agentic, Agentic Plus).
- Encaje: bueno si quieres un servicio gestionado en vez de correr modelos. Sistema de créditos.
- Precio: capa gratuita ~10.000 créditos/mes para nuevos usuarios (1.000 créditos = $1,25). ⚠️ Los planes fallan en duro (HTTP 402) al agotar créditos, y las páginas fallidas consumen cuota.
- Vigencia: VIGENTE.

**Mistral OCR**
- Qué hace: modelo OCR gestionado (OCR 4.1 actual; OCR 3 sigue disponible) que convierte PDFs e imágenes a Markdown con tablas HTML, bounding boxes, confidence scores.
- Encaje: muy bueno como API barata de OCR multimodal para escaneados; se llama fácil desde Python.
- Precio: OCR 4.1 a $4/1000 páginas ($2 en Batch); Document AI a $5/1000. OCR 3 más barato ($2/1000, $1 en Batch). Plan Free de Mistral incluye $10/mes de créditos API (~5.000 páginas OCR 3).
- Vigencia: VIGENTE.

**Marker (Datalab)**
- Qué hace: conversor PDF→Markdown muy rápido basado en la suite de modelos Surya (~120 pág/s en una H100 en batch), con paso opcional de refinamiento LLM (`--use_llm`).
- Encaje: bueno para conversión general a volumen. ⚠️ Licencia restrictiva: GPL-3.0 + licencia RAIL-M sobre los pesos que restringe uso comercial por encima de un umbral de ingresos. Revísalo con cuidado antes de comercializar.
- Precio: open source (con restricciones de licencia comercial).
- Vigencia: VIGENTE.

**MinerU (OpenDataLab)**
- Qué hace: motor de parseo de alta precisión, líder en documentos complejos y contenido CJK (chino/japonés/coreano), OCR en 84 idiomas. Nacido en el pre-entrenamiento de InternLM.
- Encaje: bueno si tus documentos son académicos/complejos o multilingües.
- Precio: open source. ⚠️ Footprint de instalación grande (~2 GB de pesos en el primer arranque; setup complejo en Windows).
- Vigencia: MUY VIGENTE.

**Unstructured (unstructured.io)**
- Qué hace: particiona muchos formatos (no solo PDF: email, PPT, etc.) en una taxonomía de elementos consistente. Apache-2.0.
- Encaje: útil si tu corpus es heterogéneo (mucho email/PPT). Su precisión en PDFs difíciles no compite con los VLM de 2026.
- Precio: librería open source + plataforma/API de pago.
- Vigencia: VIGENTE.

**Zerox (getomni-ai)**
- Qué hace: OCR "dead simple" de documentos a Markdown pasando imágenes a un modelo de visión (GPT-4o-mini por defecto; soporta OpenAI, Azure, Bedrock, Gemini, Vertex, Anthropic vía LiteLLM).
- Encaje: bueno como enfoque minimalista. Paquetes npm (`zerox`) y pip (`py-zerox`).
- Precio: open source MIT; pagas la API del modelo de visión que uses (no tiene precio por página propio).
- Vigencia: VIGENTE (~12,3k estrellas, activo).

**APIs cloud (Document AI gestionado)**, todas confirmadas ACTIVAS a septiembre 2026:
- **Azure AI Document Intelligence** (antes Form Recognizer, ahora v4.0 GA): capa gratuita F0 de 500 páginas/mes. Read/OCR ~$1,50/1000 pág, Layout ~$10/1000 pág. ⚠️ Cifras vía fuentes secundarias (Azure Retail Prices API); la tabla oficial se renderiza dinámicamente.
- **Google Document AI**: OCR ~$1,50/1000 (baja a $0,60 >5M/mes), Form Parser $30/1000 ($20 >1M), Layout Parser $10/1000. Sin capa gratuita mensual recurrente ( solo el crédito único de $300 de nuevo cliente GCP.
- **Amazon Textract**: Detect Document Text (OCR) $1,50/1000, Tables $15/1000, Forms $50/1000 (⚠️ una fuente secundaria sitúa Forms en $15/1000 ) reconfirma). Free Tier de 3 meses: 1.000 pág/mes OCR, pero solo 100 pág/mes en Forms/Tables.
- **Reducto (reducto.ai)**: ACTIVO. El 1 de septiembre de 2026 lanzó el modelo **r-1**, cuya nota de prensa (PR Newswire) describe "reducing errors by up to 20%... bringing the all-in cost down to 1¢ per page", posicionado como "up to 6× less" que pipelines multi-herramienta (los modelos agénticos previos costaban entre 3 y 6 céntimos/página, según MarkTechPost, 7-sep-2026). El 20% de reducción de error se mide contra su propio pipeline anterior, y es hosted-only (sin pesos abiertos). Tarifas Standard: r-1 Parse $10/1000, Extract $20/1000, Classify $7,50/1000, Edit $60/1000. Capa gratuita: $150 / 15.000 créditos. Growth/Enterprise por ventas.

### CATEGORÍA 2 ( GATEWAYS Y ORQUESTACIÓN DE MODELOS

**OmniRoute (diegosouzapw) ) VERIFICACIÓN PRIORITARIA ✅ REAL Y VIGENTE**
- Qué hace: gateway LLM open source (MIT), local-first, que unifica cientos de proveedores tras un endpoint OpenAI-compatible en `localhost:20128`. Auto-fallback en 4 tiers (suscripción → API key → barato → gratis), compresión de tokens (RTK+Caveman), servidor MCP integrado, claves cifradas AES-256-GCM en disco local, cero telemetría cloud.
- Encaje: útil sobre todo para tus **herramientas de coding** (Claude Code, Cursor, Cline, Copilot) y para evitar rate limits/vendor lock-in. Para tu backend de producción con PydanticAI es menos directo que un gateway gestionado, porque la robustez (failover, upgrades, acceso remoto seguro) depende enteramente de tu configuración y operación.
- Precio: gratis, open source MIT, self-host (npm/Docker/Electron/Termux).
- Vigencia: VIGENTE y muy activo (crecimiento rápido). ⚠️ **Advertencia crítica**: sus propios términos listan ~15 proveedores cuyos TOS prohíben acceso vía proxy; los "tokens gratis" no son todos legalmente usables. ⚠️ Homónimos: hay un "OmniRoute" distinto en SourceForge y menciones genéricas; el real es **diegosouzapw/OmniRoute** (omniroute.online). Las cifras de nº de proveedores (160→338) y estrellas varían mucho entre versiones/fuentes, tómalas como orientativas.

**OpenRouter**
- Qué hace: agregador hosted, un solo API key para 300+ modelos (Claude, GPT, Gemini, Llama, DeepSeek, etc.) tras endpoint OpenAI-compatible.
- Encaje: **la forma más rápida** de probar y comparar modelos multimodales desde tu backend sin gestionar infra. Perfecto para tu fase de comparación de modelos.
- Precio: pasa el precio del proveedor sin markup + comisión del 5,5% al comprar créditos (mínimo $0,80 con tarjeta). ⚠️ Añade ~40–150 ms de latencia según tests independientes.
- Vigencia: VIGENTE.

**LiteLLM**
- Qué hace: proxy open source self-hosted que normaliza 100+ proveedores tras endpoint OpenAI-compatible; claves virtuales, presupuestos, rate limits, fallback y logging en YAML versionable.
- Encaje: excelente si quieres control total y cero markup, en Python. Añade ~8–20 ms de latencia.
- Precio: gratis open source (self-host); pagas tu infra.
- Vigencia: VIGENTE.

**Portkey**
- Qué hace: gateway observability-first con caché semántico, guardrails (PII, filtros), gestión de prompts. Open-sourced su core en 2026 + cloud.
- Encaje: bueno si necesitas caché/guardrails/observabilidad avanzados. Latencia baja (<1 ms según fuentes propias; 10–20 ms en tests independientes).
- Precio: Developer "Free Forever" con 10k logs/mes; Production $49/mes con 100k logs + $9 overage por 100k requests.
- Vigencia: VIGENTE.

**Otros vigentes**: Requesty (gestionado, 400+ modelos, router en Rust, ~8 ms P50, 99,99% SLA, hosting EU), Cloudflare AI Gateway, Helicone (gateway + observabilidad), Unify, Martian. Nota: RouteLLM es un framework de routing de investigación, no un gateway completo.

**Comparación rápida de gateways:**
| Gateway | Tipo | Markup | Latencia añadida | Cuándo elegirlo |
|---|---|---|---|---|
| OpenRouter | Hosted | Sin markup + 5,5% compra créditos | ~40–150 ms | Prototipar, máxima variedad de modelos, cero infra |
| LiteLLM | Self-host OSS | Cero | ~8–20 ms | Control total en Python, sin vendor lock-in |
| Portkey | Gateway + observabilidad | ( | <1–20 ms | Caché semántico, guardrails, PII |
| OmniRoute | Local-first OSS | Cero | ) | Herramientas de coding, evitar rate limits |

### CATEGORÍA 3: RAG Y GraphRAG

**Bases de datos vectoriales**
- **pgvector** (Postgres): la opción por defecto para RAG en producción en 2026 hasta ~10–50M vectores. Coste incremental casi cero si ya usas Postgres. Recomendación de arranque. Hybrid search vía `pg_trgm`/full-text + vector RRF.
- **Qdrant**: motor dedicado en Rust, mejor capa gratuita, filtrado potente, soporte nativo sparse (SPLADE, miniCOIL) y multi-vector ColBERT. Self-host ~$30–50/mes VPS; Cloud $100–300/mes.
- **Weaviate**: campeón de hybrid search (BM25 + vector + metadata en una query), módulos de embedding integrados.
- **Milvus**: para escala de miles de millones de vectores.
- **Chroma**: prototipado y MVPs, muy simple (corre en un VPS de <$30/mes).
- **LanceDB**: local-first/edge, formato columnar Lance sobre object storage, multimodal. Cloud serverless aún en beta.

**GraphRAG y grafos de conocimiento**
- **Microsoft GraphRAG**: implementación clásica con detección de comunidades (Leiden) + resumen global/local. Potente para "preguntas globales" que cruzan documentos, pero **muy caro en construcción/indexado**.
- **LightRAG** (HKUDS, EMNLP 2025 Findings): grafo dual + actualización incremental. Según el paper (Guo et al., github.com/HKUDS/LightRAG), una recuperación por consulta cuesta **<100 tokens y 1 llamada API en LightRAG vs ~610.000 tokens y ~610.000/C_max llamadas en GraphRAG**, y las actualizaciones incrementales recortan el tiempo de update ~50%. El repo afirma que "LightRAG consistently outperforms NaiveRAG, RQ-RAG, HyDE, and GraphRAG" en agricultura, informática, legal y dominios mixtos. **El mejor punto de entrada para tu comparación graph-RAG.**
- **nano-graphrag**: alternativa ligera (~1.100 líneas), asíncrona, tipada, con backends NetworkX/Neo4j/Faiss/Ollama. Ideal para entender y hackear la mecánica de GraphRAG.
- **Graphiti (Zep)**: grafo de conocimiento **temporal** para memoria de agente (bi-temporal, invalidación de hechos, provenance por episodio). Corre sobre Neo4j/FalkorDB. Es para memoria de agente, no tanto Q&A de documentos. Paper arXiv 2501.13956 (Zep supera a MemGPT: 94,8% vs 93,4% en DMR; +18,5% en LongMemEval con -90% de latencia). ~20k+ estrellas.
- **Neo4j**: la base de grafos subyacente más común para todos los anteriores.

**Evaluación RAG (más allá de Ragas/DeepEval que ya conoces)**
- **TruLens** (open source, TruEra): pionero del "RAG Triad" (context relevance, groundedness, answer relevance) con LLM-as-judge, sin necesidad de ground truth, se puede correr sobre tráfico de producción. Instrumentación OpenTelemetry, así que puedes atar métricas a spans concretos (retrieval, generación, tool use). En benchmarks de terceros (AIMultiple, marzo 2026) quedó primero frente a W&B Weave, RAGAS, DeepEval y UpTrain en varias métricas de ranking.
- **Arize Phoenix**: eval-first, plantillas RAG (context precision, faithfulness), **visualización UMAP de embeddings** (killer feature para detectar drift de recuperación). Source-available (Elastic License 2.0), self-host gratis.
- Otros: Quotient, UpTrain, Laminar (Apache 2.0, OTel-native).

### CATEGORÍA 4 ( EVALUACIÓN Y OBSERVABILIDAD LLM

**Pydantic Logfire ) LA MÁS RELEVANTE PARA TI**
- Qué hace: plataforma de observabilidad AI-native construida sobre OpenTelemetry, del equipo de Pydantic. Traza **toda la app** (no solo llamadas LLM): HTTP, DB, vector search, lógica de negocio, en timelines unificados. Paneles de conversación, token tracking, cost monitoring, tool call inspection. Expone datos vía SQL (Postgres-compatible), lo que permite que tu propio agente de coding consulte producción. Integra con `pydantic-evals`.
- Encaje: **PERFECTO**. Es del mismo equipo que PydanticAI y se integra nativamente; ideal para FastAPI + PydanticAI (renderiza cada request de FastAPI como spans anidados). Instrumentación en dos líneas (`pip install logfire`, `logfire.configure()`).
- Precio: Personal gratis (10M records/mes, 1 seat, 3 proyectos, 30 días retención); Team $49/mes (5 seats, +$25/seat extra); Growth $249/mes; luego $2/M records con price cap opcional. Según su propia comparación, a escala media (5 usuarios, 50M spans) sería 8× más barato que Arize, 27× que Langfuse y 40× que LangSmith, trátalo como cifra del vendedor, pero el modelo por-records (no per-seat/per-trace) sí escala mejor. SDK MIT, servidor closed source.
- Vigencia: MUY VIGENTE.

**Langfuse**
- Qué hace: plataforma LLMOps open source (MIT), tracing, prompt management, datasets, evals, dashboards. Sobre ClickHouse.
- Encaje: muy bueno si quieres OSS self-hostable framework-agnóstico (vía OTel).
- Precio: Free 50k observaciones/mes (30 días retención); Core $29/mes; Pro $199/mes. Self-host gratis con todas las features.
- Vigencia: MUY VIGENTE. **Adquirida por ClickHouse** (blog del 16-ene-2026), junto a una Serie D de $400M liderada por Dragoneer a una valoración de $15.000M; tenía >2.000 clientes de pago y 26M+ instalaciones de SDK/mes. ClickHouse declaró que "stays open source and self-hostable... no planned changes to licensing".

**Otros**: LangSmith (mejor si usas LangChain/LangGraph; per-seat $39 + traces, self-host enterprise-only, Developer gratis con 1 seat/5k traces), Helicone (proxy OSS Apache 2.0, logging con cambio de una línea de base-URL), W&B Weave, Braintrust (eval-first, free hasta 5 usuarios, Pro $249/mes), Opik (Comet), Traceloop/OpenLLMetry. **Arize** anunció ser adquirida por **Dynatrace**: comunicado del 13-ago-2026 por "$915 million... approximately $815 million in cash as well as replacement equity awards"; los fundadores Jason Lopatecki y Aparna Dhinakaran se incorporan al cierre, previsto "later this quarter or early in Dynatrace's third quarter". Aún sin cerrar.

### CATEGORÍA 5 ( GENERACIÓN DE UI ASISTIDA POR IA (complementarias a v0.app)

**Thesys C1 ) GENERATIVE UI AS A SERVICE (muy relevante)**
- Qué hace: API middleware que transforma respuestas del LLM en componentes UI interactivos en vez de texto, con streaming en tiempo real. Endpoint OpenAI-compatible + C1 React SDK que reemplaza al renderizador de markdown. Retries/fallback de proveedores internos. Themeable (dark mode incluido).
- Encaje: **MUY directo** con tu caso. Es literalmente "Generative UI as a service" para React/Next.js, y encaja con tu pipeline JSON tipado → componentes. Puedes darle reglas de sistema tipo "render financial data as dashboard charts".
- Precio: producto comercial hospedado (NO open source; no hay repo que clonar). Tiene playground gratuito (chat.thesys.dev). El precio detallado no está publicado abiertamente, hay que registrarse en console.thesys.dev / contactar a Thesys para tarifas concretas.
- Vigencia: VIGENTE (GA desde abril 2025, fundada en San Francisco en 2024 por Rabi Shankar Guha y Parikshit Deshmukh; más de 300 equipos usándolo).

**Vercel AI SDK**
- Qué hace: toolkit TypeScript para apps AI; su función `streamUI` genera Generative UI streameando React Server Components. Base de la tecnología de v0.
- Encaje: MUY bueno para tu Next.js. ⚠️ **IMPORTANTE**: el desarrollo de **AI SDK RSC está PAUSADO** (Vercel recomienda migrar); el patrón vigente es Generative UI vía tool calls + `message.parts` tipadas en el cliente (renderizar componentes React según `part.state === 'output-available'`).
- Precio: open source gratis; pagas los proveedores LLM.
- Vigencia: SDK VIGENTE; la variante RSC específica está pausada.

**CopilotKit + AG-UI**
- Qué hace: SDK full-stack para apps agénticas y Generative UI (React/Angular/mobile/Slack/Teams). Creadores del protocolo **AG-UI** (adoptado por Google, LangChain, AWS, Microsoft, Mastra y **PydanticAI**). Soporta patrones controlled/declarative/open-ended, incluyendo **Open-JSON-UI**, directamente relevante a tu "componentes generados a partir de JSON tipado".
- Encaje: **MUY bueno**, especialmente porque AG-UI ya está adoptado por PydanticAI. Ideal para conectar tu backend agéntico con UI generativa tipada por JSON de forma estándar y bidireccional.
- Precio: open source (core) + planes de pago (Intelligence/self-hosting).
- Vigencia: MUY VIGENTE.

**Herramientas de prototipado (complementos a v0.app)**
- **21st.dev**: marketplace de 12.000+ componentes React/Tailwind sobre shadcn/ui, con Magic MCP para generar componentes desde el editor (Cursor/Claude Code). Free: navegación + 2 copias/día; membresía desbloquea copias ilimitadas; 21st AI (generación) es add-on con créditos. 1,4M desarrolladores, 200k MAU.
- **Magic Patterns**: generador de prototipos UI con IA; integrado con 21st.dev.
- **Subframe**: herramienta de diseño AI que compone componentes React/Tailwind en canvas y exporta código limpio.
- **Bolt.new, Lovable**: generadores de apps full-stack por prompt (útiles para prototipar rápido, no específicos de Generative UI tipada).
- **shadcn/ui**: base de componentes copy-paste (no dependencia) sobre Radix + Tailwind, estándar del ecosistema ( el sustrato sobre el que trabajan casi todos los anteriores.

### CATEGORÍA 6 ) PRODUCTIVIDAD GENERAL PARA DESARROLLO CON IA (uso personal)

**Gestión de prompts**
- **PromptLayer**: plataforma de prompt management para equipos (versionado, evals, observabilidad, tracing). Editor visual sin redeploy, permite que expertos de dominio iteren sin tocar código.
- **Agenta**: LLMOps open source MIT, self-hostable; playground de comparación lado a lado, versionado Git-like (variants/branches + environments), evals (LLM-as-judge + humana), observabilidad.
- **Latitude**: open source, con PromptL (lenguaje con variables/condicionales/loops), agentes autónomos, human-in-the-loop, self-host o cloud.
- Otros: Helicone (observabilidad + prompts, Apache 2.0), Pezzo, PromptHub, Humanloop.

**Asistentes de código / IDEs**
- **Cursor, Windsurf, Claude Code, Codex, Cline, Aider**: asistentes/agentes de código vigentes en 2026. Se integran bien con gateways como OmniRoute/OpenRouter (apúntalos al endpoint local y siguen funcionando).

## Recommendations

**TOP 5 RECOMENDADAS PARA EMPEZAR YA** (priorizando capa gratuita generosa + encaje con FastAPI/PydanticAI/Next.js):

1. **Pydantic Logfire** (observabilidad), instálalo PRIMERO. Es del mismo equipo que PydanticAI, integración nativa, 10M records/mes gratis. Te dará visibilidad de todo el pipeline (FastAPI + PydanticAI + vector search + llamadas al LLM) desde el día uno, y consultable por SQL. Es la pieza con mejor ROI para tu stack específico.
2. **Docling** (parseo): MIT, corre local, Python nativo, `DoclingDocument` tipado (Pydantic v2), maneja tablas/layout complejos. Complétalo con **anydoc de Firecrawl** para Office rápido y **Mistral OCR** ($1–2/1000 pág en Batch) o **Reducto r-1** (1¢/página) para escaneados.
3. **OpenRouter o LiteLLM** (gateway), OpenRouter para prototipar tu comparación de modelos multimodales sin infra; migra a LiteLLM si quieres self-host sin markup en Python. (OmniRoute mejor para tus herramientas de coding, no para el backend de producción.)
4. **pgvector + Qdrant** (RAG): arranca con pgvector (casi cero coste), migra a Qdrant si necesitas filtrado/rendimiento. Para tu comparación GraphRAG usa **LightRAG** como baseline económico y **Microsoft GraphRAG** solo para las preguntas globales que crucen documentos. Añade **TruLens** (RAG Triad) y **Arize Phoenix** (UMAP de drift) a tu Ragas/DeepEval.
5. **Vercel AI SDK + Thesys C1** (Generative UI), el AI SDK para el patrón vigente de Generative UI en tu Next.js (evita la variante RSC pausada); Thesys C1 si quieres delegar la generación de UI a un servicio. Evalúa fuerte **CopilotKit/AG-UI** porque el protocolo AG-UI ya está adoptado por PydanticAI y soporta Open-JSON-UI (tu caso exacto de JSON tipado → componentes).

**Umbrales/benchmarks que cambiarían estas recomendaciones:**
- Si superas ~10–50M vectores o necesitas multi-tenancy: migra de pgvector a Qdrant/Milvus.
- Si tu corpus es <100 documentos: **NO uses GraphRAG** (solo añade coste/latencia); vector RAG + reranker basta. GraphRAG solo se justifica cuando necesitas responder preguntas que agregan/cruzan muchos documentos.
- Si necesitas OCR de escaneados a volumen: compara Mistral OCR Batch ($1–2/1000) vs Reducto r-1 (1¢/pág) vs Azure/Google/AWS. Para PDFs con texto embebido, quédate en open source local (Docling/anydoc).
- Si el volumen de traces crece mucho: Logfire (por-records) escala mejor en coste que alternativas per-seat (LangSmith) o per-trace.
- Si necesitas comparar fidelidad de tool use/vision entre proveedores: un gateway OpenAI-compatible puede perder fidelidad; considera llamar a los SDK nativos o un gateway multi-formato.

## Caveats
- **Homónimos (crítico)**: "anydoc" y "OmniRoute" tienen múltiples productos con nombres casi idénticos. Verifica que usas **github.com/firecrawl/anydoc** y **diegosouzapw/OmniRoute** (omniroute.online) respectivamente, no los clones comerciales.
- **OmniRoute y TOS**: sus propios términos indican que ~15 proveedores prohíben acceso vía proxy; no todos los "tokens gratis" son legalmente usables. No lo pongas en el camino crítico de producción sin evaluar tu configuración de failover.
- **Precios cloud Document AI**: las cifras exactas de Azure (Read/Layout) y Amazon Textract (Forms/Tables) provienen en parte de fuentes secundarias porque las tablas oficiales se renderizan dinámicamente. Hay discrepancia sobre Amazon Textract Forms ($50 vs $15/1000). Reconfírmalas en vivo en el portal correspondiente antes de presupuestar.
- **Thesys C1**: no publica precios abiertamente; hay que contactar/registrarse para tarifas. Es hosted, no self-hostable, dependes de su disponibilidad (aunque tienen fallback interno de proveedores).
- **Vercel AI SDK RSC pausado**: no construyas sobre la variante RSC específica; usa el patrón vigente de Generative UI del SDK (tool calls + message parts).
- **Marker**: licencia restrictiva (GPL-3.0 + RAIL-M) que limita uso comercial por encima de cierto umbral de ingresos.
- **Movimientos de mercado**: Arize en proceso de adquisición por Dynatrace ($915M, aún sin cerrar); Langfuse adquirida por ClickHouse (enero 2026, sin cambios de licencia previstos). No afecta su uso hoy, pero vigila cambios de licencia/precio a medio plazo.
- Las cifras de número de proveedores/estrellas de OmniRoute varían mucho entre fuentes y versiones; son orientativas, no absolutas.