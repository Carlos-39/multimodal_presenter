# PROYECTO.md — Contexto maestro del sistema

> **Qué es este archivo.** Contexto permanente del proyecto para cualquier agente de IA o persona que trabaje en el repositorio. Se lee al inicio de cada sesión de desarrollo para tener el marco completo. NO es una orden de trabajo — las órdenes de trabajo concretas llegan por hito, con sus propios criterios de aceptación. Este archivo describe el "qué" y el "por qué"; cada prompt de hito describe el "qué hacer ahora".

---

## 1. Qué es el sistema

Aplicación inteligente de presentación de información multimodal — trabajo de grado de Ingeniería de Sistemas (Universidad del Valle).

El sistema recibe información en múltiples formatos (texto, PDF, imagen, y a futuro audio) y la transforma en **presentaciones estructuradas e interactivas**, con el objetivo explícito de **reducir la carga cognitiva** del usuario y facilitar su comprensión. Un "transformador de información" (a) analiza la entrada multimodal, (b) genera contenido estructurado priorizado, (c) selecciona cómo presentarlo, y (d) permite al usuario preguntar sobre el contenido generado.

**Propuesta de valor diferencial** (frente a herramientas como NotebookLM): ser más **abierto, verificable y trazable**. Cada afirmación presentada debe poder rastrearse a su origen en el documento fuente. Esta es la línea que no se negocia.

**Naturaleza del proyecto:** prototipo exploratorio de validación técnica y conceptual, NO producto de producción. Alcance controlado, sin entrenar modelos propios, apoyado en APIs.

---

## 2. Principio rector del diseño (el más importante — atraviesa casi todo)

**Determinismo donde la decisión es objetiva; criterio del LLM solo donde es genuinamente interpretativo.**

- Toda decisión resoluble a partir de la forma verificable de los datos (¿esto es una secuencia temporal? ¿tiene notación matemática? ¿qué tipo de gráfico admite esta forma de datos?) se resuelve con **reglas fijas en código convencional**, nunca delegada al LLM. Esto garantiza consistencia del 100% entre ejecuciones.
- Solo lo genuinamente interpretativo (redacción, tono, énfasis, priorización semántica del contenido) se delega al LLM, donde la variación es estilo, no inconsistencia.

**Por qué:** la inconsistencia impredecible entre usos sucesivos de un sistema generativo es una fuente de carga cognitiva (carga extrínseca) que no viene del contenido, sino del comportamiento errático del sistema. Este principio la elimina de raíz.

Cuando dudes si algo debe resolverlo el código o el LLM: si la respuesta es objetivamente verificable a partir de los datos, es código.

---

## 3. Arquitectura funcional (por capas)

Cada capa existe porque una decisión de diseño la requiere. No es arquitectura genérica.

1. **Ingesta y extracción (determinista, sin LLM).** Recibe el documento y lo convierte en contenido estructurado limpio. Detecta la forma de los datos, notación matemática, términos de baja frecuencia, y valida qué tipos de representación son admisibles. NO usa pypdf para aplanar PDFs a texto plano (ese fue el error del PoC anterior) — el PDF debe llegar al modelo como binario multimodal nativo.
2. **Contrato de datos tipado (Pydantic).** El schema que define la estructura de la presentación. Es la frontera entre backend y frontend. El hueco `content_type`↔`content` del PoC anterior (campos independientes sin validación cruzada) DEBE estar cerrado desde el diseño mediante discriminated unions o validadores. Todo lo demás se monta encima de este contrato.
3. **Estructuración con LLM.** El modelo aplica la heurística núcleo/satélite, redacta el contenido y genera la organización semántica. NO decide lo determinista (tipo de componente, layout) — eso ya viene resuelto de la Capa 1. Emite JSON validado contra el contrato de la Capa 2.
4. **Validación posterior.** Verificación estructural en código (barata) + verificación de coherencia semántica con LLM. Ambas desde el inicio.
5. **Transporte / streaming.** Puente backend↔frontend con eventos tipados en tiempo real (protocolo AG-UI vía CopilotKit, o Vercel AI SDK — a confirmar en su hito).
6. **Presentación (Generative UI).** Frontend Next.js que renderiza componentes según el contrato: núcleo estructural fijo vs. zona dinámica, reglas compositivas de layout, selector de nivel de detalle, atribución de fuentes interactiva.
7. **Componente conversacional.** Chat anclado a fuentes, con preguntas sugeridas contextuales.
8. **Telemetría (transversal).** Captura de eventos de uso para la evaluación.
9. **Subsistema RAG/GraphRAG (posterior, separado).** El mecanismo de recuperación para el experimento comparativo. NO es parte del núcleo — se añade cuando el pipeline de transformación ya está estable.

---

## 4. Stack tecnológico

- **Backend:** Python + FastAPI + PydanticAI (orquestación con tipado estricto — el LLM debe emitir JSON validado contra esquemas Pydantic, con reintentos automáticos si no valida).
- **Modelo:** Anthropic **claude-sonnet-5** como primario (multimodal nativo; salida estructurada por `PromptedOutput`, elegido en el Hito 5d para permitir el streaming incremental), con **Gemini vía OpenRouter** como fallback opcional (`FallbackModel` de PydanticAI). El pipeline es agnóstico al modelo (se inyecta). Nota histórica: el diagnóstico inicial contempló Gemini 3.1 Pro y el PoC anterior usaba gemini-2.5-flash como atajo; el motor se migró a Anthropic durante el Hito 5. Ya no se usa una clave de Gemini directa.
- **Frontend:** Next.js + Tailwind, con Generative UI.
- **Observabilidad:** Pydantic Logfire (del mismo equipo que PydanticAI, integración nativa, capa gratuita generosa). Conectar desde el Hito 0.
- **Herramientas candidatas** (a confirmar en sus hitos, del inventario ya investigado): anydoc de Firecrawl y/o Docling para parseo; CopilotKit/AG-UI para transporte (AG-UI ya está adoptado oficialmente por PydanticAI); pgvector + Qdrant y LightRAG para el subsistema RAG posterior.

---

## 5. Decisiones de diseño de Fase 2 que afectan al código

Referencia rápida. El detalle completo con justificación está en `/docs/Fase2_Decisiones_Diseno.md`.

- **Modalidad y ritmo:** el sistema decide estructura y secuencia inicial (audio para explicaciones, texto para anclajes/conceptos clave); una vez generado, el usuario controla el ritmo (pausar, releer, saltar).
- **Consistencia de organización:** tipo de componente decidido por reglas deterministas según la forma de los datos, no por criterio libre del LLM (principio rector).
- **No redundancia texto+audio:** regla general = no duplicar. Excepción determinista SOLO para notación matemática (patrones sintácticos) y términos de baja frecuencia (siglas, términos que aparecen una sola vez sin contexto). Nombres propios raros quedan fuera (limitación aceptada).
- **Isomorfismo en gráficos:** reglas deterministas filtran qué tipo de gráfico admite la forma de datos → el LLM elige dentro de lo válido. Verificación posterior en dos niveles: estructural (código) + coherencia semántica (LLM). Ambas desde el inicio.
- **Atribución de fuentes:** resaltado interactivo directo sobre el documento original (clic en una afirmación → muestra el fragmento fuente resaltado). Requiere que el frontend tenga el documento original navegable.
- **Chunk cognitivo:** límite de ~4 TIPOS de estructura cognitiva distinta por vista (no cantidad bruta de contenido). Contable con código.
- **Layout:** reglas compositivas deterministas (no catálogo cerrado de plantillas fijas). Elemento de mayor peso visual → posición dominante; apoyo según cantidad; si se excede el umbral de tipos → apilado vertical con scroll.
- **Núcleo/satélite (RST):** solo la distinción binaria como heurística de priorización (vía prompt), SIN parser RST formal. Núcleo → modo resumen; satélite → modo detallado.
- **Pipeline:** 3 fases (extracción determinista → estructuración LLM → validación posterior). No monolítico, no 4 fases completas de la literatura.
- **Stable Core Pattern:** núcleo fijo (navegación, controles de audio, selector de detalle, estructura del chat) nunca cambia de posición/comportamiento entre generaciones. Solo el área de contenido es dinámica.
- **Interacción sin coacción:** NO hay checkpoints obligatorios. El núcleo se muestra primero (completo y autosuficiente, nunca empobrecido a propósito); el detalle y el chat están disponibles a un clic, visibles pero no impuestos. Al profundizar en una sección, se ofrecen 2-3 preguntas sugeridas contextuales (invitación, no obligación).
- **Adaptación al usuario:** control explícito de nivel de detalle (resumen/detallado) + acceso a la fuente. Sin detección automática de nivel (queda como extensión futura).
- **Chat:** cada respuesta anclada obligatoriamente a un fragmento verificable del documento; si no se puede anclar, decirlo explícitamente. Respuestas como componentes interactivos cuando aplica (Generative UI aplicada al chat).
- **Evaluación:** NASA-TLX + prueba de comprensión post-uso + telemetría comportamental propia (sin sensores fisiológicos).

---

## 6. Cómo se trabaja este repositorio

- **Trabajo por hitos.** Cada sesión de desarrollo aborda UN hito con criterios de aceptación explícitos. No se construye todo de una vez (esa es la causa del código "vibe codeado" que ya hubo que auditar y descartar).
- **Verificación en cada corte.** Al terminar cada hito, se verifica que cumple sus criterios de aceptación antes de pasar al siguiente.
- **Qué NO hacer:** no adelantar trabajo de hitos futuros aunque parezca obvio; no tomar atajos que contradigan el principio rector (sección 2) o las decisiones de Fase 2 (sección 5); no delegar al LLM decisiones que son deterministas; no reintroducir el hueco de validación del contrato.
- **Trazabilidad:** commits limpios y descriptivos, historia de git legible desde el inicio. Secretos (API keys) SIEMPRE en `.env` gitignoreado, NUNCA commiteados (lección del PoC anterior, donde una key real quedó en el historial).

---

## 7. Orden de construcción (hitos)

- **Hito 0** — Andamiaje del repo (estructura, secretos, CI mínimo, Logfire conectado).
- **Hito 1** — Contrato de datos tipado (schema Pydantic, hueco content_type↔content cerrado).
- **Hito 2** — Pipeline de transformación extremo a extremo, versión mínima (documento entra → JSON válido sale, con el LLM real).
- **Hito 3** — Frontend base con Stable Core Pattern (renderiza el JSON, streaming conectado).
- **Hito 4** — Multimodal real (subida de archivos, PDF binario nativo, imagen).
- **Hito 5** — Decisiones cognitivas (núcleo/satélite, modos de detalle, layout compositivo, atribución de fuentes, telemetría).
- **Hito 6** — Componente conversacional (chat anclado, preguntas sugeridas).
- **Hito 7** — Subsistema RAG vectorial, luego GraphRAG, más el protocolo experimental de comparación.
- **Hito 8** — Evaluación con usuarios (5-10 personas, batería del Punto 10).

Cortes naturales de alcance: tras el Hito 6 hay una tesis base defendible; el Hito 7 (RAG/GraphRAG) es lo que la lleva a nivel de mención honorífica.

---

## 8. Documentos de referencia en el repo

- `/docs/Fase1_Diagnostico_Tecnologico.docx` — diagnóstico tecnológico (stack, modelos, vigencia verificada ago 2026).
- `/docs/Fase2_Diseno_Conceptual.docx` — diseño conceptual redactado (borrador).
- `/docs/Fase2_Decisiones_Diseno.md` — las 12 decisiones de diseño con su justificación completa y las opciones que se descartaron (consultar cuando un hito toque una decisión específica).
- `/docs/Inventario_Herramientas.md` — herramientas candidatas investigadas y verificadas (consultar en los hitos que eligen herramientas: parseo, transporte, RAG).
