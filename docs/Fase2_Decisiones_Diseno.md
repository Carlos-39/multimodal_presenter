# Fase 2 — Diseño Conceptual: Decisiones de Diseño (Documento Maestro)

**Propósito de este documento:** registro completo y fiel de cada decisión de diseño tomada para la Fase 2 del anteproyecto, con su explicación, las opciones que se consideraron, y por qué se eligió lo que se eligió. No es la redacción final de A1/A2/A3 — es el material de base contra el cual comparar cuando se redacte con palabras propias, para no perder ni un detalle ni una justificación de las que ya se acordaron.

Cada decisión indica su origen (si venía del inventario original de 11 puntos derivado de los documentos de investigación de Gemini y Claude, o si surgió de una pregunta/observación propia durante la discusión) y su estado (cerrada, o cerrada con matiz/nota para revisar en desarrollo).

**Principio transversal que atraviesa casi todas las decisiones:** determinismo con código normal donde la decisión es objetivamente verificable a partir de la forma de los datos; criterio del LLM reservado solo para lo genuinamente interpretativo (redacción, tono, énfasis). Este principio aparece repetido en los Puntos 1.5, 2, 3 y 5, y puede presentarse en la redacción como un criterio rector único, no como reglas sueltas sin conexión.

---

## PARTE A1 — Criterios de organización de información

### Punto 1 — Ritmo del sistema vs. control del usuario (principio de modalidad de Mayer)

**Origen:** inventario original (relacionado con el principio de modalidad, Ginns 2005).

**El problema:** el principio de modalidad de Mayer (preferir audio sobre texto para explicaciones que acompañan contenido visual) tiene un respaldo experimental fuerte (d=0.72 según el meta-análisis de Ginns 2005), pero ese efecto es mucho más fuerte cuando es el sistema quien controla el ritmo de presentación (d=0.93) que cuando el usuario controla el ritmo (d=-0.14 en la réplica de Reinwein 2012). El sistema de la tesis es exploratorio e interactivo — el usuario navega a su propio ritmo.

**Decisión:** el sistema decide la estructura y secuencia inicial del contenido (tratado como si fuera ritmo controlado por el sistema, aplicando el principio de modalidad con fuerza plena: audio para explicaciones, texto para anclajes/conceptos clave). Una vez el contenido ya está generado, el usuario tiene control total del ritmo de consumo (pausar, releer, saltar, volver atrás) — en ese momento el principio de modalidad se relaja, porque el usuario ya cuenta con su propia herramienta de autorregulación de carga.

**Nota de aplicación:** los principios de Mayer en conjunto funcionan como el argumento de diseño — cada decisión de presentación (qué va en audio, qué en texto, qué se señaliza) debe poder justificarse citando el principio específico que la sustenta, no como sugerencias sueltas sino como base argumentativa sistemática.

---

### Punto 1.5 — Consistencia del criterio de organización entre generaciones

**Origen:** propuesto por Carlos durante la discusión del Punto 1 (no estaba en el inventario original de 11 puntos).

**El problema:** el LLM decide hoy, con libertad total, cómo estructurar cada sección (qué tipo de componente usar: texto, tabla, timeline). El mismo tipo de contenido puede resolverse de forma distinta entre una generación y otra, sin que haya cambiado nada relevante en la entrada — esto rompe la posibilidad de que el usuario se forme un modelo mental estable de cómo funciona la herramienta, generando carga extrínseca pura (no viene del contenido, viene de la impredictibilidad del sistema). Al mismo tiempo, forzar un estándar completamente rígido tiene su propio costo: puede no encajar bien con contenido que no calza en el molde.

**Decisión:** separar dos tipos de decisiones que hoy están mezcladas bajo el criterio libre del LLM:
1. **Decisiones objetivamente determinables por la forma de los datos** (ej.: una secuencia de elementos con fechas explícitas → siempre timeline; datos con columnas de valores comparables → siempre tabla) se resuelven con reglas fijas en código normal, nunca delegadas al LLM. Esto garantiza consistencia del 100% entre ejecuciones, porque la decisión no depende de que el modelo "decida" nada — es una función determinista sobre la forma del dato.
2. **Decisiones genuinamente interpretativas** (redacción del contenido, tono, qué detalle destacar dentro de un párrafo) sí quedan a criterio del LLM, porque ahí la variación entre ejecuciones no es un problema — es estilo, no inconsistencia estructural.

**Conexión:** esta separación es la misma lógica que después se aplica en el Punto 2 (excepción de redundancia) y el Punto 3 (isomorfismo en gráficos) — es, en efecto, el principio transversal de todo el documento.

---

### Punto 2 — Excepción de redundancia texto+audio

**Origen:** inventario original (relacionado con el principio de redundancia de Mayer y su excepción reconocida en la literatura).

**El problema:** la regla general de Mayer dice que mostrar texto idéntico mientras se narra en audio es contraproducente (la mente gasta recursos comparando ambas fuentes en vez de simplemente absorber el contenido). Pero la literatura reconoce excepciones: conceptos técnicos atípicos, fórmulas matemáticas no estándar, o casos donde el usuario necesita un anclaje visual estático de referencia. Dejar esta excepción a criterio libre del LLM ("usa tu juicio") reabriría el mismo problema de inconsistencia del Punto 1.5.

**Decisión:** regla determinista, pero **acotada solo a casos verificables de forma confiable** (no a cualquier caso que "suene técnico"):
1. **Notación matemática** — detectada por patrones sintácticos objetivos (símbolos matemáticos, delimitadores LaTeX, exponentes/subíndices). Es razonablemente robusto porque son símbolos, no juicios de contenido.
2. **Términos técnicos "raros"** — redefinidos no como juicio subjetivo de "rareza" (imposible de detectar bien de forma confiable) sino como propiedad medible del texto: siglas en mayúsculas (3+ letras seguidas), o términos que aparecen una sola vez en el documento sin contexto explicativo adicional en ningún otro lugar.

**Matiz importante (planteado por Carlos):** el caso de **nombres propios poco comunes** queda deliberadamente **fuera** del determinismo. Un detector de patrones ambicioso para este caso es poco confiable dada la naturaleza desordenada de los documentos reales — se acepta como limitación conocida y de bajo impacto (el peor caso es una pequeña confusión de pronunciación momentánea, no daño grave a la comprensión) en vez de forzar una regla que probablemente fallaría con frecuencia.

Fuera de los dos casos verificables (1 y 2), nunca se permite redundancia texto+audio.

**Nota de Carlos, aplicable a todo el documento:** todas estas decisiones son a priori y quedan sujetas a ajuste con la implementación real — el objetivo es dejar la menor incertidumbre posible, sin pretender una precisión perfecta e inalcanzable.

---

### Punto 3 — Isomorfismo estructural en gráficos y diagramas generados

**Origen:** inventario original (relacionado con el modelo ITPC de Schnotz — descripciones vs. depicciones, e interferencia estructural).

**El problema:** las depicciones (gráficos, diagramas) son cognitivamente eficientes solo cuando su forma visual corresponde honestamente a la estructura lógica real de los datos que representan. Si el sistema genera, por ejemplo, un gráfico de líneas para datos que no son una serie temporal continua, el usuario absorbe una relación falsa como si fuera verdad sobre el contenido — esto es peor que no mostrar ningún gráfico. Hoy nada en el sistema verifica que la elección del tipo de gráfico (`chart_type`) sea semánticamente correcta dado el tipo real de los datos — solo se valida que el JSON tenga la forma correcta (PydanticAI), no que la elección tenga sentido.

**Decisión — dos componentes:**

1. **Restricción previa (Opción B):** reglas deterministas filtran de antemano qué tipos de gráfico/artefacto son válidos según la forma real de los datos (ej.: si hay dimensión temporal con progresión → línea es válida, pastel no; si son categorías sin orden natural con proporciones de un total → pastel válido, línea no). El LLM elige solo dentro de las opciones ya validadas como estructuralmente correctas — nunca elige libremente entre las 4 opciones sin restricción.

2. **Verificación posterior del contenido generado dentro del artefacto**, en dos niveles (ambos incluidos desde el primer alcance, no como mejora futura — decisión explícita de Carlos, porque el costo real está en latencia/consumo en tiempo de ejecución, que es aceptable, y no en tiempo de desarrollo, que es bajo):
   - **Nivel barato (código, sin LLM):** verificación estructural mecánica — ¿las fechas están en orden cronológico? ¿hay duplicados o contradicciones? ¿el conteo de elementos respeta el límite de chunk (ver Punto 5)?
   - **Nivel más profundo (segundo paso de LLM):** verificación de coherencia semántica — comparar que el contenido generado realmente refleja lo que dice el documento fuente, no solo que tiene la forma correcta.

**Justificación explícita de Carlos para incluir ambos niveles desde ya:** los LLM tienen un sesgo inherente a producir salidas que parecen correctas y completas (orientados a "satisfacer" al usuario) incluso cuando no lo son — esto justifica la doble capa de verificación como parte del diseño base, no como añadido opcional.

---

### Punto 4 — Atribución de fuentes: mecanismo concreto en la interfaz

**Origen:** inventario original (relacionado con el marco de coste-beneficio de verificación de Vasconcelos et al. y la atribución de fuentes de DocPres).

**El problema:** cuando verificar información es costoso o incómodo, las personas tienden a confiar sin verificar (sobreconfianza / automation bias). El schema del sistema ya tiene un campo `source_reference` en `Section` que asocia cada sección generada a su origen en el documento — pero hoy ese dato no se usa para nada en el frontend. Es información generada y huérfana.

**Decisión:** Opción C — **resaltado interactivo directo sobre el documento fuente**. Al hacer clic en una afirmación de la presentación generada, el sistema muestra el documento original (panel lateral o vista dividida) con el fragmento exacto resaltado visualmente. Se descartó la opción intermedia más barata (tooltip o panel simple bajo demanda, sin mostrar el documento completo navegable).

**Justificación de apostar por la versión más ambiciosa:** Carlos decidió invertir esfuerzo real aquí de forma consciente, usando el margen que dejan otras decisiones marcadas como "opcionales" en este mismo documento (detección de nivel de usuario, Cognitive Forcing Functions del chat) — porque esta pieza es central a la propuesta de valor diferencial de la tesis frente a NotebookLM: "más abierto, verificable y trazable".

**Nota de dependencia (no bloquea la decisión conceptual, sí la implementación):** esto requiere que el frontend pueda mostrar el documento original completo y navegable, lo cual depende de que el bloque de roadmap de código que conecta la capacidad multimodal a la UI (subida de archivos) avance primero.

---

## PARTE A2 — Esquema de segmentación y flujo de procesamiento

### Punto 5 — Definición operativa de "chunk" (unidad de información) + distribución espacial/layout

**Origen:** inventario original (Cowan ~4 chunks vs. Miller 7±2), con extensión de layout identificada por Carlos durante la discusión.

**El problema (conteo):** "usar ~4 chunks como límite" no significa nada operativamente hasta definir qué cuenta como "una unidad". La teoría de chunking no es sobre cantidad bruta de información, sino sobre cuántas unidades ya procesadas y agrupadas puede sostener la mente a la vez — una tabla de 50 filas puede ser un solo chunk si se percibe como bloque coherente; dos párrafos sueltos sin relación pueden ser dos chunks que compiten por atención aunque cada uno sea corto.

**Decisión (conteo de chunks):** Opción B — un chunk se cuenta por **tipo de estructura cognitiva distinta** combinada en una misma vista (texto, tabla, timeline, gráfico, chat), no por cantidad de objetos `Section` (Opción A, ciega al contenido real) ni por interactividad de elementos estimada subjetivamente (Opción C, reabriría el problema de juicio libre del LLM). Límite de ~4 tipos distintos combinados por vista, coherente con el criterio conservador de Cowan y con la decisión ya tomada en el Punto 1.5. Se cuenta con código simple (contar `content_type` distintos presentes), sin necesitar juicio del LLM.

**El problema (layout, extensión identificada por Carlos):** contar chunks correctamente no resuelve cómo se distribuyen espacialmente en la pantalla. Si un tipo de contenido (ej. un video) ocupa mucho espacio y otro (ej. texto corto) queda visualmente "soso" al lado, se rompe el equilibrio — y esto conecta con la contigüidad espacial de Mayer y la jerarquización visual. Además, un catálogo cerrado de pocas plantillas de layout fijas chocaría con la decisión del Punto 11 (el usuario controla su nivel de detalle, generando volúmenes de contenido variables que no calzarían bien en un molde rígido).

**Decisión (layout):** sistema de **reglas compositivas deterministas**, no un catálogo cerrado de 3-4 plantillas fijas con nombre propio. En vez de plantillas completas prearmadas, se definen principios de composición atómicos que se combinan deterministamente según el contenido real presente:
- El tipo con mayor peso visual (ej. video, imagen grande, tabla extensa) ocupa la posición dominante.
- El contenido de apoyo se ubica según cuántos elementos de apoyo hay (ej. 1 → al lado, 2+ → abajo en columna).
- Si se excede cierto umbral de tipos combinados, la vista pasa a distribución vertical apilada con scroll en vez de forzar todo en una sola pantalla.

Esto genera muchas configuraciones posibles de resultado final (no solo un puñado de plantillas con nombre), pero cada combinación específica sigue siendo 100% predecible y reproducible entre ejecuciones — manteniendo la consistencia priorizada en los Puntos 1.5, 2 y 3, sin caer en la rigidez de un catálogo cerrado.

**Nota:** el detalle fino de estas reglas compositivas se terminará de afinar con el desarrollo real, no en el diseño conceptual abstracto — esta decisión fija el marco (determinismo + reglas atómicas combinables), no la implementación exacta línea por línea.

---

### Punto 6 — Alcance real de implementación de RST (núcleos y satélites)

**Origen:** inventario original (Teoría de la Estructura Retórica de Mann y Thompson, mencionada en el documento de investigación de "Claude").

**El problema:** RST completa incluye no solo la distinción binaria núcleo (idea esencial)/satélite (apoyo, no esencial), sino un catálogo extenso de relaciones retóricas específicas (elaboración, concesión, contraste, causa, evidencia, etc.), cada una con definición formal. Construir un parser RST completo y confiable es un problema de investigación en PLN en sí mismo, con décadas de trabajo académico dedicado — desproporcionado para un prototipo exploratorio de trabajo de grado.

**Decisión:** Opción B — adoptar **solo la distinción binaria núcleo/satélite** como heurística de priorización de contenido, vía clasificación del LLM guiada por prompt (el LLM clasifica cada afirmación/sección extraída como "esencial" o "de apoyo"), **sin** implementar el catálogo completo de relaciones retóricas formales ni un parser RST real. Los núcleos son candidatos naturales para el "modo resumen" del Punto 11; los satélites, para el "modo detallado".

**Requisito de redacción:** esta decisión de alcance debe declararse **explícitamente** en el documento como decisión consciente ("se adopta la distinción núcleo/satélite de RST como heurística de priorización, sin implementar el catálogo completo de relaciones retóricas, dado el carácter exploratorio del prototipo"), no dejarse como limitación oculta que un jurado descubra por su cuenta.

**Razón adicional de peso (aportada por Carlos):** RST fue formulada originalmente para texto escrito y no tiene un equivalente formal establecido para audio o imagen. La heurística núcleo/satélite, en cambio, sí generaliza bien a un sistema multimodal por diseño — esto refuerza que la Opción B es más *coherente* con el alcance real del proyecto (que admite texto, imagen, audio), no solo más barata de implementar.

**Línea futura:** RST completo queda como posible profundización si en algún momento hay tiempo y recursos dedicados específicamente a eso, fuera del alcance de esta tesis.

---

### Punto 7 — Pipeline de fases del backend

**Origen:** inventario original (pipeline de 4 fases descrito en sistemas de referencia como DocPres y ArcDeck: parseo determinista → modelado discursivo → planificación contractual → renderizado programático).

**El problema:** el backend real, según la auditoría de código, es esencialmente una sola fase (extracción de texto → un llamado al LLM con `output_type` fijo → JSON de salida), mientras que el pipeline "ideal" de la literatura de referencia propone cuatro fases bien diferenciadas. Documentar el pipeline elaborado sin llevarlo a la práctica repetiría la misma brecha diseño-vs-código que ya ocurrió con el diagnóstico tecnológico (Gemini 3.1 Pro documentado vs. gemini-2.5-flash real en el código).

**Decisión:** Opción B — un **pipeline de fases reducido** (ni las 4 fases completas de la literatura, ni el "un solo prompt" actual), diseñado específicamente para dar lugar de ejecución a las decisiones ya tomadas en los Puntos 1.5, 2, 3, 5 y 6:

1. **Fase de extracción y clasificación determinista** (código, sin LLM) — aplica las reglas de tipo de dato, notación matemática y términos técnicos de los Puntos 1.5 y 2.
2. **Fase de estructuración con LLM** — aplica la heurística núcleo/satélite del Punto 6 y genera el contenido de cada sección.
3. **Fase de validación posterior** — aplica la verificación barata con código más la verificación de coherencia con LLM del Punto 3.

**Por qué esto no es "copiar la teoría" ni "ignorarla":** cada fase de este pipeline corresponde a una decisión de diseño ya tomada y justificada individualmente con teoría específica (Cowan para chunking, Schnotz para isomorfismo, la heurística núcleo/satélite para priorización) — el documento describiría el propio pipeline del sistema, justificado punto por punto, no un pipeline ajeno citado como aspiración no cumplida.

**Línea futura, explícitamente fuera del alcance de entrega:** el ciclo de crítica-refinamiento con múltiples roles de IA (planificador, crítico narrativo, juez — la Opción C del pipeline completo, descartada para la entrega) queda como línea de trabajo opcional que Carlos planea explorar como proyecto personal **después** de entregar la tesis, para no comprometer las fechas de entrega con ambición no necesaria para la sustentación.

**Nota técnica para cuando se retome esa línea futura:** para controlar el costo en tokens, ese ciclo de refinamiento debería invocarse condicionalmente (solo cuando la verificación barata con código ya detectó una señal de alerta), no correrse por defecto en cada generación — mismo patrón de capas escalonadas ya aplicado en el Punto 3.

---

## PARTE A3 — Lineamientos visuales y cognitivos

### Punto 8 — Stable Core Pattern (consistencia visual estructural)

**Origen:** inventario original (concepto descrito en el documento de investigación de "Claude" sobre GenUI).

**El problema:** el principio dice que la navegación y los controles principales de la interfaz deben mantenerse fijos e inmutables, y el dinamismo generado por la IA debe confinarse solo al área central de contenido — de lo contrario, el usuario pierde la memoria espacial de dónde está todo, generando carga extrínseca constante. El frontend actual es tan simple que probablemente ya cumple esto sin proponérselo; el riesgo real aparece cuando se construya el catálogo de Generative UI más elaborado.

**Decisión:** Opción B — definir **explícitamente ahora** qué partes de la interfaz son núcleo fijo y cuáles son zona dinámica, en vez de dejarlo como principio general sin especificar (Opción A, que se resolvería caso por caso durante el desarrollo, con riesgo de violarse sin que nadie lo note):

- **Núcleo fijo (nunca cambia posición ni comportamiento entre generaciones):** barra/menú de navegación entre secciones; controles de reproducción de audio (play/pausa/retroceder); selector de nivel de detalle (Punto 11); estructura del chat (caja de input, forma del historial — no su contenido).
- **Zona dinámica (varía según lo generado):** únicamente el área de contenido — las secciones con su `content_type` (texto/tabla/timeline/gráfico) y las respuestas del chat con sus componentes.

**Uso práctico de esta decisión:** sirve como checklist directo para cuando se construya el bloque de Generative UI real en el desarrollo — antes de hacer dinámico cualquier nuevo elemento de interfaz, se verifica si pertenece al núcleo fijo o al contenido.

---

### Punto 9 — Cognitive Forcing Functions (alcance general del sistema)

**Origen:** inventario original (Buçinca et al. 2021), con discusión extensa y sustancial durante la conversación — este fue el punto de mayor profundidad de todo el proceso.

**El problema, en su primera formulación:** la evidencia (Kreijkes et al., corregida — usar el LLM en solitario es la condición inferior en comprensión/retención frente a cualquier forma de participación activa; y Buçinca et al. sobre cómo las CFFs reducen la sobreconfianza) sugiere que el flujo de "documento entra → presentación sale" es, por naturaleza, bastante pasivo, y que introducir algún mecanismo de fricción deliberada podría ser valioso.

**Primer intento de solución (descartado):** un checkpoint donde el usuario confirma o corrige el contenido clasificado como "núcleo" antes de ver la presentación completa. **Objeción decisiva de Carlos:** esto no tiene sentido para el caso de uso central del sistema — un usuario que no domina el dominio del documento (ej. un ingeniero de sistemas leyendo un balance financiero) no puede validar con criterio real algo que no entiende; pedírselo sería contradictorio con el propósito mismo de la herramienta.

**Segundo intento de solución (también ajustado):** cambiar la pregunta de "¿es esto correcto?" a "¿qué quieres entender de este documento?" (una intención, no un juicio de contenido). **Objeción adicional de Carlos:** muchas veces el usuario ni siquiera sabe qué quiere o qué necesita preguntar — a veces solo tiene curiosidad, sin intención clara desde el minuto cero. Forzar una elección de opciones estáticas antes de ver nada real del documento seguía siendo una forma de pedir algo que el usuario, novato o simplemente curioso, no puede dar con sentido en ese momento.

**Tensión de fondo identificada explícitamente por Carlos:** el dilema entre diseñar para el mejor resultado cognitivo posible (lo que sugeriría forzar participación activa) y respetar la autonomía real del usuario (quien puede legítimamente no querer pensar activamente en ese momento, aunque eso implique, a la larga, peor comprensión para él — es su elección, no la del sistema).

**Decisión final:** **no hay ningún checkpoint obligatorio** en ningún punto del flujo (ni antes ni después de la generación). En su lugar, la arquitectura ya decidida en otros puntos constituye por sí misma el mecanismo de "fuerza cognitiva", sin bloquear ni exigir nada:
- El núcleo (Punto 6) se muestra primero, automáticamente, sin pedir nada.
- El detalle/satélite está disponible **a un clic de distancia, sin fricción** — no escondido, no tras una pregunta que responder.
- El chat está siempre visible y accesible (Punto 8, núcleo fijo).

La "fuerza cognitiva" no viene de un obstáculo artificial que el usuario deba sortear — viene de que la interacción activa (profundizar, preguntar) es tan fácil y está tan a la vista que compite naturalmente contra la pasividad total, sin necesitar prohibirla. El usuario que quiere quedarse en modo pasivo puede hacerlo libremente; el usuario que quiere profundizar encuentra el camino casi sin costo.

**Adición confirmada — preguntas sugeridas contextuales:** al hacer clic en "ver más" sobre una sección específica, el sistema ofrece 2-3 preguntas sugeridas **relevantes a esa sección concreta** (generadas por el sistema al momento de crear el contenido, no genéricas), presentadas como componentes clicables en el chat (coherente con la decisión de Generative UI aplicada a la conversación del punto del chat). Esto ayuda especialmente al usuario novato que ya tiene contexto visual concreto pero aún no sabe cómo formular una pregunta. Son invitación, nunca obligación — el usuario puede usarlas o escribir su propia pregunta libremente.

**Aclaración fijada, crítica para no perder calidad en el primer resultado:** el núcleo que el usuario ve primero **no** debe ser deliberadamente pobre o incompleto para "forzarlo" a pedir más — debe ser información genuinamente completa y autosuficiente por sí misma, que ya dé comprensión real del documento sin necesitar nada adicional. La calidad de ese primer resultado depende enteramente de qué tan bien funcione la clasificación núcleo/satélite (Punto 6), no de esta decisión de interfaz. El satélite aporta profundidad y matiz adicional — no es la parte que le falta al núcleo para tener sentido.

---

### Punto Transversal — Chat de preguntas y respuestas (capacidad #4 del objetivo general)

**Origen:** traído por Carlos explícitamente como tema aparte, señalando el riesgo de comparación directa con NotebookLM.

**El problema:** a diferencia de la transformación inicial (que ocurre una sola vez), el chat es una conversación en curso donde cada respuesta depende del contexto acumulado de turnos anteriores. Esto introduce riesgos nuevos: inconsistencia entre turnos (la respuesta 3 podría contradecir sutilmente lo dicho en la respuesta 1), deriva de fuente o "source drift" (las respuestas pueden alejarse del documento original y mezclarse con conocimiento general del modelo sin que el usuario lo note — el mismo problema de alucinación con apariencia de autoridad visto en la investigación), y el "efecto mirilla" (un chat de texto plano no tiene memoria visual — todo desfila y se pierde en el scroll). El sistema hoy es completamente *stateless* (sin memoria entre peticiones), así que esta capacidad no existe todavía ni en su forma más básica.

**Decisión — combinación B+C como compromiso real de diseño, D como mejora opcional futura, no prioritaria ahora:**

- **B — Anclaje obligatorio a fuente:** cada respuesta del chat debe venir anclada obligatoriamente a un fragmento verificable del documento original — extendiendo la atribución de fuentes de la transformación inicial (Punto 4) a cada turno de la conversación. Si el sistema no puede anclar una respuesta a una parte específica del documento, debe decirlo explícitamente ("esto no está directamente en el documento, es una inferencia") en vez de responder con la misma confianza que si estuviera citando texto literal. Esto es no-negociable para esta tesis específicamente, porque contradecir la propuesta de valor de "más abierto, verificable y trazable" que el propio anteproyecto ya declara sería una inconsistencia grave.

- **C — Respuestas como componentes interactivos (Generative UI aplicada a la conversación):** las respuestas se muestran como componentes persistentes (tabla, gráfico) cuando el contenido de la pregunta lo amerita, no solo como texto que se acumula y desaparece hacia arriba en el chat — reutilizando la misma capacidad de Generative UI que ya existe para la transformación inicial. Esto es, además, un argumento de diferenciación fuerte frente a un chatbot genérico de texto plano.

- **D — Cognitive Forcing Function para aclarar preguntas ambiguas** (pedir aclaración antes de responder si la pregunta admite más de una interpretación razonable dado el documento) queda como **mejora opcional futura**, no como compromiso del alcance actual — es la pieza más cara de diseñar bien de las tres, y no es estrictamente necesaria para que la capacidad de chat funcione y sea defendible.

---

### Punto 11 — Adaptación por perfil/nivel de usuario

**Origen:** traído por Carlos con intuición propia ("el usuario 1 aprende de cierta forma porque ya sabe leer"), coincide con un punto ya identificado en el inventario original a partir del hallazgo de Etkin et al. 2025 (los resúmenes de IA perjudican a lectores de alto desempeño y ayudan a los de bajo desempeño).

**El problema:** el sistema hoy da el mismo tratamiento a todos los usuarios sin importar su nivel de familiaridad con el dominio del documento o su capacidad lectora, a pesar de que la evidencia muestra que el mismo tipo de ayuda no funciona igual para todos.

**Decisión — combinación C+D:**

- **C — Control explícito del usuario, sin detección automática:** se implementa un control simple y visible en la interfaz (nivel de detalle: resumen vs. detallado), más acceso siempre disponible a la fuente original vía el campo `source_reference` que ya existe en el schema. El usuario mismo decide cuánto quiere que el sistema le resuma, según se conozca a sí mismo — no se intenta detectar automáticamente su nivel de expertise (eso sería la Opción B descartada, más cara y compleja de validar bien en un prototipo exploratorio).

- **D — Reconocimiento explícito de la limitación:** el documento debe declarar honestamente que esto es una **mitigación parcial**, no una solución completa, al hallazgo de Etkin et al. — se le da control al usuario, pero no se detecta su nivel real de forma automática.

**Naturaleza de la decisión:** Carlos la describió explícitamente como "curarse en salud" — cubre la limitación conocida de forma honesta y funcional ahora, y la detección automática de nivel de usuario queda como mejora opcional y no prioritaria para más adelante, si el tiempo y el desarrollo lo permiten.

---

## PARTE — Protocolo de Evaluación (conecta A3 con el objetivo específico 4 del anteproyecto)

### Punto 10 — Batería de evaluación realista con 5-10 personas

**Origen:** inventario original (recomendación de ambos documentos de investigación de combinar NASA-TLX + desempeño + medidas fisiológicas), ajustado a los recursos reales disponibles (5-10 personas, sin laboratorio de neurociencia).

**El problema:** la batería "ideal" de la literatura (NASA-TLX + desempeño + eye-tracking/EEG/pupilometría) no es realista con los recursos disponibles — meter medición fisiológica sin la infraestructura adecuada generaría datos ruidosos e inútiles, peor que no incluirla.

**Decisión:** Opción C — tres fuentes de datos, ninguna fisiológica:
1. **NASA-TLX** — cuestionario subjetivo estándar, gratuito, reconocible por cualquier jurado.
2. **Medida de desempeño real** — prueba corta de comprensión aplicada después de usar el sistema, que evalúa si la persona realmente entendió el contenido, no solo si "sintió" que fue fácil. Conecta directamente con el protocolo de evaluación de tres dimensiones (comprensión, interacción, utilidad percibida) ya definido en sesiones previas de trabajo sobre la tesis.
3. **Telemetría comportamental propia, capturada nativamente por la aplicación, sin sensores externos:** cuántas veces se usó el control de "profundizar" (Punto 9); si se usaron las preguntas sugeridas o se escribieron preguntas propias en el chat; cuánto tiempo se pasó en modo resumen vs. modo detallado (Punto 11); si se verificaron las fuentes (Punto 4, clics sobre el resaltado del documento original).

**Por qué la telemetría comportamental es la pieza más valiosa de esta batería:** no requiere ningún instrumento adicional (es analítica simple sobre eventos que la propia aplicación ya genera al usarse), y permite verificar en la práctica si los mecanismos de diseño decididos en esta misma Fase 2 (núcleo/satélite, preguntas sugeridas, chat de baja fricción del Punto 9) realmente generaron la interacción activa que se buscaba — es decir, no solo se mide carga cognitiva de forma abstracta, se mide si las decisiones concretas de este documento funcionaron como se esperaba.

Se descarta explícitamente lo fisiológico (eye-tracking, EEG, pupilometría) por falta de infraestructura y de tiempo reales para este alcance.

---

## Resumen — mapa de dependencias entre decisiones

Algunas decisiones dependen de otras para tener sentido pleno; vale la pena tenerlo presente al redactar para que el documento se lea como un sistema coherente, no como una lista de puntos aislados:

- El **Punto 1.5** establece el principio general (determinismo vs. criterio del LLM) que después se aplica literalmente igual en el **Punto 2** y el **Punto 3**.
- El **Punto 5** (chunk por tipo de estructura) es la misma idea del **Punto 1.5** aplicada a un límite operativo concreto.
- El **Punto 6** (núcleo/satélite) alimenta directamente al **Punto 11** (modo resumen/detallado) y al **Punto 9** (qué se muestra primero sin fricción).
- El **Punto 4** (atribución de fuentes) se extiende directamente al **punto del chat** (anclaje obligatorio de respuestas).
- El **Punto 8** (Stable Core Pattern) fija qué elementos son fijos, incluyendo el selector del **Punto 11** y la estructura del chat.
- El **Punto 7** (pipeline de fases) es, literalmente, dónde en el código viven las decisiones de los Puntos 1.5, 2, 3, 5 y 6 — no es una decisión independiente, es la organización de todas las demás.
- El **Punto 10** (evaluación) mide directamente si el **Punto 9** y el **Punto 11** funcionaron en la práctica.

---

## Qué falta después de este documento

Este documento registra las **decisiones de fondo** ya tomadas. Lo que falta, y que corresponde a Carlos escribir con sus propias palabras, es la **redacción formal** de:
- **A1** (criterios de organización) — basado principalmente en los Puntos 1, 1.5, 2, 3 y 4.
- **A2** (esquema de segmentación y flujo) — basado principalmente en los Puntos 5, 6 y 7.
- **A3** (lineamientos visuales y cognitivos) — basado principalmente en los Puntos 8, 9, el punto del chat, el Punto 11, y el protocolo de evaluación del Punto 10.

Ninguna decisión de este documento ha sido redactada aún en la forma final del anteproyecto — este es el material de trabajo, no el texto de entrega.
