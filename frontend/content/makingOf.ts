import type { Capitulo } from "@/lib/makingOf";

/**
 * El contenido del «making of»: cómo está construida la aplicación y cómo se comporta por dentro.
 *
 * Es estático y está escrito a mano. Generarlo con un modelo en cada visita sería lo único de
 * este sistema que no se podría rastrear hasta una fuente.
 */
export const CAPITULOS: Capitulo[] = [
  {
    slug: "piezas",
    numero: 1,
    acto: "idea",
    titulo: "Qué hace y con qué piezas",
    etapa: "Fase 1 · Diagnóstico tecnológico",
    conclusion:
      "Dos aplicaciones que se hablan por una red privada, y un modelo distinto para cada tarea según lo que esa tarea necesita.",
    bloques: [
      {
        tipo: "prosa",
        texto:
          "La aplicación recibe un documento y lo devuelve reorganizado. Entra un texto, un PDF, una imagen o una grabación de audio, y sale una presentación dividida en secciones de cuatro tipos (texto, tabla, línea de tiempo y gráfico), con dos niveles de lectura. Cada sección conserva la frase del original de la que salió, y al pulsarla se abre el documento con ese pasaje señalado.",
      },
      {
        tipo: "prosa",
        texto:
          "Alrededor de esa presentación hay un chat que responde a partir del documento, una narración en audio, una presentación en diapositivas y una biblioteca para guardar lo que se hizo. Todo funciona sin cuenta.",
      },

      { tipo: "encabezado", texto: "Dos aplicaciones y un solo origen" },
      {
        tipo: "prosa",
        texto:
          "Por dentro son dos programas. El **backend**, en Python con FastAPI y PydanticAI, hace el trabajo pesado: lee la fuente, llama a los modelos, valida lo que devuelven y busca cada cita en el original. El **frontend**, en Next.js con React y TypeScript, dibuja la presentación y responde a lo que hace la persona.",
      },
      {
        tipo: "prosa",
        texto:
          "El navegador solo habla con el frontend. Las rutas de la API pasan por él y siguen hacia el backend por una red privada, y el backend no tiene dirección pública. Como todo sale de un mismo origen, no hace falta abrir permisos entre dominios ni usar cookies de terceros, y la única puerta expuesta a internet es una.",
      },
      {
        tipo: "prosa",
        texto:
          "El backend está partido en cuatro paquetes: los esquemas del contrato de datos, el flujo de procesamiento, el almacenamiento y la API. El almacenamiento vive aparte del flujo por una razón concreta, y es que así un identificador de usuario no tiene ningún camino para terminar dentro de un prompt.",
      },

      { tipo: "encabezado", texto: "Un modelo para cada tarea" },
      {
        tipo: "prosa",
        texto:
          "No todas las tareas necesitan el mismo modelo. Las que deciden qué tan fiel es el resultado al documento usan el modelo con más capacidad de razonamiento; las que solo tienen que ser rápidas usan uno liviano.",
      },
      {
        tipo: "tabla",
        cabeceras: ["Tarea", "Modelo"],
        filas: [
          ["Estructurar la presentación", "Claude Sonnet 5, con Gemini 3.1 Pro de respaldo"],
          ["Chat, guiones de narración y de diapositivas, verificación de gráficos", "Claude Sonnet 5"],
          ["Adelanto inicial y decidir qué secciones llevan ilustración", "Claude Haiku 4.5"],
          ["Escuchar un audio", "Gemini 3.8 Flash, sin respaldo"],
          ["Leer la narración en voz alta", "tts-1"],
          ["Transcribir una pregunta dictada", "gpt-4o-mini-transcribe"],
          ["Dibujar ilustraciones", "Gemini 3.1 Flash Image, con Ideogram 3 y gpt-image-1 de respaldo"],
        ],
      },
      {
        tipo: "prosa",
        texto:
          "Ninguna fase del flujo sabe qué modelo tiene delante. Los modelos se construyen en un solo módulo que lee la configuración y los entrega ya armados, así que cambiar de proveedor no toca la lógica. Eso permitió que el motor principal cambiara durante el desarrollo: el diagnóstico tecnológico proponía Gemini 3.1 Pro, y hoy Gemini es el respaldo de Claude Sonnet 5.",
      },
      {
        tipo: "prosa",
        texto:
          "El diagnóstico también proponía generar los componentes con una herramienta y conectar las dos partes con una librería de transporte. Al final los componentes se escribieron a mano y el transporte es un flujo propio de eventos, porque el contrato de datos ya bastaba para componer la interfaz y una capa intermedia añadía piezas sin aportar nada.",
      },
      {
        tipo: "hallazgo",
        texto: "Cada tarea usa el modelo que le basta, y ninguna fase sabe cuál es.",
      },
    ],
  },
  {
    slug: "codigo-y-modelo",
    numero: 2,
    acto: "idea",
    titulo: "Código para lo comprobable, modelo para lo interpretable",
    etapa: "Fase 2 · Diseño conceptual",
    conclusion:
      "Lo que se puede comprobar mirando los datos lo decide el código; el modelo solo decide lo que de verdad hay que interpretar.",
    bloques: [
      {
        tipo: "prosa",
        texto:
          "Antes de escribir código se fijó un principio que atraviesa casi todo el sistema. Si una decisión se puede resolver mirando la forma de los datos, la toma una regla escrita en código y sale igual en cada ejecución. Que una serie de fechas es una línea de tiempo, o que unos valores con columnas comparables son una tabla, son cosas que se comprueban, no que se opinan.",
      },
      {
        tipo: "prosa",
        texto:
          "Al modelo de lenguaje le queda lo interpretativo: la redacción, el énfasis, el tono, qué es lo esencial de un documento. Ahí que dos ejecuciones salgan distintas es estilo, no un defecto.",
      },
      {
        tipo: "prosa",
        texto:
          "El motivo es cognitivo. Si la misma clase de contenido se presenta cada vez de una forma distinta, quien usa la herramienta no logra hacerse una idea estable de cómo funciona, y ese desconcierto es un esfuerzo que no viene del documento sino de la herramienta.",
      },

      { tipo: "encabezado", texto: "Cómo se reparte en la práctica" },
      {
        tipo: "tabla",
        cabeceras: ["Lo decide el modelo", "Lo decide el código"],
        filas: [
          ["La redacción de cada sección", "Los tipos de contenido que existen"],
          ["Qué es núcleo y qué es satélite", "Si un tipo de gráfico es válido para esos datos, y corregirlo si no"],
          ["Qué tipo de contenido propone para cada sección", "Dónde está cada cita en el documento"],
          ["Qué frase del original cita", "Cómo se reparten las columnas en la pantalla"],
        ],
        nota: "El modelo propone el tipo de cada sección junto con su contenido, y el código corrige la propuesta cuando sale de lo admisible.",
      },

      { tipo: "encabezado", texto: "Cuatro criterios para organizar" },
      {
        tipo: "prosa",
        texto:
          "El diseño conceptual se apoya en la Teoría de la Carga Cognitiva y en la Teoría Cognitiva del Aprendizaje Multimedia, y de ahí salen cuatro criterios.",
      },
      {
        tipo: "prosa",
        texto:
          "El primero reparte la información entre la vista y el oído: las explicaciones pueden ir a la narración y la pantalla se reserva para lo que conviene ver. El segundo prohíbe repetir en texto lo que se narra, y por eso la narración es una síntesis escrita para escucharse y no una lectura de la pantalla. El tercero exige que un gráfico tenga la forma que tienen sus datos. El cuarto es la trazabilidad: cada afirmación conserva el camino de vuelta a su fuente.",
      },

      { tipo: "encabezado", texto: "Núcleo y satélite" },
      {
        tipo: "prosa",
        texto:
          "Para separar lo esencial del detalle se tomó una sola idea de la Teoría de la Estructura Retórica: en un texto hay **núcleos**, que contienen la afirmación central, y **satélites**, que la justifican, la ejemplifican o le dan contexto. El modelo clasifica cada sección en uno de los dos. El modo resumido muestra los núcleos y el detallado añade los satélites.",
      },
      {
        tipo: "prosa",
        texto:
          "No se usa nada más de esa teoría, ni su catálogo de relaciones ni un analizador. La distinción binaria basta, y tiene una ventaja que la teoría completa no tiene: sirve igual para un audio o una imagen.",
      },

      { tipo: "encabezado", texto: "Reglas en lugar de plantillas" },
      {
        tipo: "prosa",
        texto:
          "La propuesta original hablaba de plantillas adaptativas. Lo que quedó es otra cosa con el mismo propósito: un conjunto pequeño de tipos de contenido y unas reglas de composición que se comprueban en código. Una plantilla es un molde que se elige; una regla es una restricción que se verifica. Con reglas, la forma final siempre está dentro de lo que esos datos admiten, y cuando no lo está el sistema la corrige.",
      },
      {
        tipo: "hallazgo",
        texto: "Lo que se puede comprobar no se le pregunta al modelo.",
      },
    ],
  },
  {
    slug: "contrato",
    numero: 3,
    acto: "fuente",
    titulo: "El contrato",
    etapa: "Etapa · Contrato de datos",
    conclusion:
      "Una presentación solo existe si cumple el contrato, y el contrato hace imposible declarar un tipo y guardar otro.",
    bloques: [
      {
        tipo: "prosa",
        texto:
          "Todo lo que el sistema produce tiene una forma fija, escrita como esquema de Pydantic en el backend y como tipos de TypeScript en el frontend. Es la frontera entre las dos partes, y se definió antes de pedirle al modelo que generara nada.",
      },
      {
        tipo: "prosa",
        texto:
          "Una presentación tiene un título y al menos una sección. Cada sección lleva un identificador, un rol que vale núcleo o satélite, una referencia a su fuente y un bloque de contenido de una de cuatro clases: texto, tabla, línea de tiempo o gráfico. La referencia de fuente trae la cita exacta que se va a resaltar, la página cuando el original es un PDF y las posiciones de inicio y fin cuando es texto.",
      },

      { tipo: "encabezado", texto: "El tipo y el contenido son el mismo objeto" },
      {
        tipo: "prosa",
        texto:
          "La forma ingenua de escribir esto es con dos campos hermanos, uno que dice de qué tipo es la sección y otro que guarda el contenido. Nada obliga a que coincidan, así que una sección podría declararse gráfico y traer una frase cualquiera, y el error aparecería mucho después, al dibujarla.",
      },
      {
        tipo: "figura",
        figura: "hueco-contrato",
        pie: "A la izquierda, dos campos que nada obliga a coincidir. A la derecha, el tipo vive dentro del contenido.",
      },
      {
        tipo: "prosa",
        texto:
          "En el contrato no existe ese campo suelto. El tipo vive dentro de cada bloque de contenido, y el contenido de la sección es una **unión discriminada**: Pydantic mira el tipo para saber qué forma esperar, y si la forma no corresponde, la sección no valida. El tipo declarado y el contenido real no pueden desalinearse porque son la misma cosa.",
      },
      {
        tipo: "hallazgo",
        texto: "Un estado inválido que no se puede representar no hace falta validarlo.",
      },

      { tipo: "encabezado", texto: "Lo que el contrato rechaza" },
      {
        tipo: "prosa",
        texto:
          "Ningún modelo del contrato admite campos que no estén declarados. Una tabla cuyas filas no tienen tantas celdas como columnas no valida. Un gráfico tiene que elegir su tipo de un conjunto cerrado y traer categorías y series numéricas. Una sección sin fuente o sin rol no existe, y una presentación sin secciones tampoco. Las pruebas de esta parte son, sobre todo, pruebas de rechazo: comprueban que lo que no debe entrar no entra.",
      },

      { tipo: "encabezado", texto: "Lo que vive fuera" },
      {
        tipo: "prosa",
        texto:
          "Dos cosas acompañan a la presentación sin ser parte de ella. El **estado de anclaje** de cada sección viaja en un sobre aparte, porque no lo decide el modelo sino el código que busca la cita. Y la **ilustración generada** es un campo opcional de un tipo que no tiene referencia de fuente, de modo que es imposible confundirla con contenido que viene del documento.",
      },
      {
        tipo: "prosa",
        texto:
          "El chat reutiliza los mismos bloques de contenido, la misma referencia de fuente y el mismo estado de anclaje. Las diapositivas tienen un contrato propio, con el papel de cada lámina y una marca para las que sintetizan sin cita.",
      },
    ],
  },
  {
    slug: "nunca-aplanar",
    numero: 4,
    acto: "fuente",
    titulo: "Nunca aplanar la fuente",
    etapa: "Etapa · Entrada multimodal",
    conclusion:
      "El PDF y la imagen llegan al modelo tal como son, porque convertirlos a texto pierde justo lo que un modelo multimodal sabe leer.",
    bloques: [
      {
        tipo: "prosa",
        texto:
          "La decisión que más condiciona la transformación es una negativa: la fuente no se convierte a texto plano antes de que el modelo la lea. El PDF y la imagen se entregan en su forma original.",
      },
      {
        tipo: "figura",
        figura: "aplanar",
        pie: "Al convertir a texto sobreviven las palabras. Las tablas, los gráficos y la disposición de la página no.",
      },
      {
        tipo: "prosa",
        texto:
          "Existen buenas librerías que convierten un documento a texto o a Markdown, y se evaluaron. Lo que devuelven conserva las palabras y pierde casi todo lo demás: una tabla queda como una ristra de valores sin columnas, un gráfico desaparece y la disposición de la página se aplana. Un modelo multimodal está hecho para leer precisamente eso que se pierde.",
      },
      {
        tipo: "prosa",
        texto:
          "Se comprobó con un PDF hecho a propósito, con un gráfico cuyos valores solo existen como píxeles, una tabla en texto real y un párrafo. Por el camino de extraer texto, del gráfico no salía ningún valor. Entregando el PDF entero, el modelo devolvió los cuatro valores como un gráfico de barras y además leyó la tabla. Con un libro escaneado pasa algo parecido: el modelo lee el texto de la página sin que haga falta reconocimiento óptico previo.",
      },
      {
        tipo: "hallazgo",
        texto: "Un convertidor a texto destruye justo aquello que un modelo multimodal está hecho para leer.",
      },

      { tipo: "encabezado", texto: "La puerta de entrada" },
      {
        tipo: "prosa",
        texto:
          "Antes de tocar ningún modelo, la entrada se revisa. El archivo se lee por fragmentos con un tope de 20 MB, su tipo se comprueba por los bytes y no por la extensión, solo se admite una lista cerrada de formatos y un archivo vacío o corrupto se rechaza con un mensaje que dice qué pasó. Se puede mandar un texto, un archivo o los dos; en ese caso el texto viaja como instrucción junto al archivo.",
      },
      {
        tipo: "prosa",
        texto:
          "El texto pegado sí se trata como texto, porque eso es lo que es. Se parte en párrafos con sus posiciones y recibe un identificador estable calculado a partir de su contenido, así que el mismo texto siempre se reconoce como el mismo documento.",
      },

      { tipo: "encabezado", texto: "El precio, y por qué se paga" },
      {
        tipo: "prosa",
        texto:
          "No aplanar tiene una consecuencia que recorre el resto del sistema. Con texto, el código puede comparar letra por letra la cita del modelo con el original. Con un PDF o una imagen no puede, porque comparar exigiría extraer el texto, que es lo que se decidió no hacer antes de generar. De esa tensión salen los niveles de fidelidad de la atribución.",
      },
    ],
  },
  {
    slug: "audio",
    numero: 5,
    acto: "fuente",
    titulo: "El audio pasa primero por la percepción",
    etapa: "Etapa · Audio como entrada",
    conclusion:
      "Un audio no se transcribe: un modelo que oye lo convierte en evidencia con hablantes, tiempos y énfasis, y el resto del flujo no cambia.",
    bloques: [
      {
        tipo: "prosa",
        texto:
          "El modelo que estructura la presentación no acepta audio. La salida obvia sería transcribirlo y tratar el resultado como texto, pero eso es aplanar la fuente. Una transcripción conserva las palabras y pierde quién las dijo, cómo y con qué seguridad.",
      },
      {
        tipo: "prosa",
        texto:
          "La solución es una fase previa y aislada de **percepción**. Un modelo con entrada acústica nativa escucha la grabación y devuelve una evidencia estructurada: segmentos con hablante, texto, tiempos, énfasis, forma de decir y confianza, más los eventos no verbales y el contexto acústico.",
      },
      {
        tipo: "figura",
        figura: "pipeline-audio",
        pie: "El audio gana una fase previa. Lo que sale de ella entra al flujo por donde entra el texto.",
      },

      { tipo: "encabezado", texto: "Qué se le pide al modelo que oye" },
      {
        tipo: "prosa",
        texto:
          "La instrucción de percepción pide anotar solo lo que se puede observar en la señal y bajar la confianza ante la duda en vez de adivinar. Una regla en código descarta las marcas de énfasis que el modelo no puede citar literalmente de su propia transcripción, para que no anote un énfasis sobre palabras que no escribió.",
      },
      {
        tipo: "prosa",
        texto:
          "Lo que llega a la estructuración es esa evidencia junto con instrucciones que convierten los rasgos en decisiones de presentación. Lo enfatizado es candidato a núcleo. Lo dicho con duda se presenta matizado. Si hay más de un hablante, cada idea queda atribuida al suyo.",
      },
      {
        tipo: "prosa",
        texto:
          "Para saber si esta fase aporta algo, se comparó con la vía de transcribir sobre las mismas grabaciones. La diferencia clara está en los hablantes, y es de clase, no de grado: una transcripción plana llega como un bloque corrido, así que nadie puede atribuir lo que no está en la entrada, mientras que la evidencia separa a cada hablante y cada cifra queda con su dueño.",
      },
      {
        tipo: "hallazgo",
        texto: "La información no se degrada al aplanar: se pierde.",
      },

      { tipo: "encabezado", texto: "Cómo se ve desde fuera" },
      {
        tipo: "prosa",
        texto:
          "En cuanto termina la percepción, la transcripción aparece en pantalla, para que haya algo que leer mientras la estructuración todavía trabaja. En el panel de fuente se muestra con un aviso de que es lo que el modelo oyó, y al abrir la fuente de una sección el reproductor salta al segundo exacto de la cita.",
      },
      {
        tipo: "prosa",
        texto:
          "Se aceptan siete formatos de audio, incluido el que usan por defecto las grabadoras de los teléfonos, con un tope de 15 minutos. El tope sale de la propia evidencia, que crece con la duración de la grabación y tiene que caber en lo que el modelo de percepción puede escribir de una vez.",
      },
      {
        tipo: "prosa",
        texto:
          "Esta fase no tiene modelo de respaldo, y es una decisión. Si la anotación pasara en silencio a otra familia de modelos, su calidad cambiaría sin que nadie se enterara. Si falla, el sistema lo dice.",
      },
    ],
  },
  {
    slug: "estructurar",
    numero: 6,
    acto: "fuente",
    titulo: "Estructurar y validar",
    etapa: "Etapa · Flujo mínimo de transformación",
    conclusion:
      "Una sola llamada al modelo construye la presentación, y cada sección pasa por el código antes de salir.",
    bloques: [
      {
        tipo: "prosa",
        texto:
          "La transformación tiene tres fases, más la de percepción cuando la fuente es audio. Solo una de ellas llama al modelo en el camino principal.",
      },
      {
        tipo: "tabla",
        cabeceras: ["Fase", "Quién la hace", "Qué hace"],
        filas: [
          ["Percepción", "Modelo que oye", "Solo con audio: convierte la grabación en evidencia estructurada"],
          ["Extracción", "Código", "Identifica la fuente y prepara lo que el modelo va a recibir, sin llamar a ninguno"],
          ["Estructuración", "Modelo", "Clasifica en núcleo y satélite, redacta y organiza la presentación"],
          ["Validación", "Código y modelo", "Ancla cada cita, corrige los gráficos y, si los hay, los contrasta con la fuente"],
        ],
      },

      { tipo: "encabezado", texto: "La llamada al modelo" },
      {
        tipo: "prosa",
        texto:
          "Un agente de PydanticAI recibe la fuente y una instrucción que le pide clasificar cada sección como núcleo o satélite, elegir su tipo de contenido, citar fragmentos exactos del original como fuente y devolver un objeto que cumpla el contrato. Si lo que devuelve no valida, la librería le pide que lo corrija y vuelve a intentarlo.",
      },
      {
        tipo: "prosa",
        texto:
          "Que el núcleo sea completo y se entienda solo es responsabilidad de esta fase. El control de nivel de detalle de la interfaz solo muestra u oculta; nunca rellena lo que falta.",
      },

      { tipo: "encabezado", texto: "Antes de que una sección salga" },
      {
        tipo: "prosa",
        texto:
          "Cada sección se valida antes de emitirse. El código comprueba que su identificador no esté repetido, busca la cita en la fuente y calcula sus posiciones, aplica la regla de los gráficos y la envía con su estado de anclaje. Cuando han salido todas, si hay gráficos, un segundo agente compara cada uno con el documento para comprobar que no solo tiene una forma correcta sino que dice lo mismo que el original.",
      },
      {
        tipo: "prosa",
        texto:
          "Ese juez semántico se diseñó con un caso fiel, uno con una cifra alterada y uno con una afirmación que el documento no respalda. Marca los dos últimos y deja pasar el primero, y lo que encuentra se muestra como observación sin borrar el gráfico.",
      },

      { tipo: "encabezado", texto: "Todo se relee del original" },
      {
        tipo: "prosa",
        texto:
          "El chat, las preguntas sugeridas, la narración y las diapositivas no trabajan sobre la presentación generada sino sobre el documento original, que se vuelve a leer en cada petición. La presentación es una selección entre núcleos y satélites, y construir encima de ella perdería lo que quedó fuera.",
      },

      { tipo: "encabezado", texto: "Fallar a la vista" },
      {
        tipo: "prosa",
        texto:
          "Una clave ausente, un corte a mitad de la transmisión o una salida que no valida después de los reintentos terminan en un error visible, nunca en una presentación a medias que parezca terminada. La transformación se puede volver a intentar desde el mismo aviso.",
      },
      {
        tipo: "hallazgo",
        texto: "Todo lo que llega a la pantalla ya pasó por el contrato.",
      },
    ],
  },
  {
    slug: "forma-y-datos",
    numero: 7,
    acto: "fuente",
    titulo: "La forma sigue a los datos",
    etapa: "Etapa · Presentación",
    conclusion:
      "Un gráfico no puede contradecir la forma de sus datos: si el modelo elige mal, el código lo corrige siempre de la misma manera.",
    bloques: [
      {
        tipo: "prosa",
        texto:
          "Un gráfico cuya forma no corresponde a los datos enseña una relación que no existe. Una torta con valores negativos, o una línea que une categorías sin orden, dicen algo falso aunque cada número esté bien.",
      },

      { tipo: "encabezado", texto: "La forma de los datos manda" },
      {
        tipo: "prosa",
        texto:
          "La **regla de isomorfismo** mira los datos de un gráfico y deduce su forma real: si las series están alineadas con las categorías, si el eje está ordenado en el tiempo o es numérico, cuántas series y categorías hay y si todos los valores son no negativos. De esa forma sale el conjunto de tipos de gráfico admisibles.",
      },
      {
        tipo: "figura",
        figura: "isomorfismo",
        pie: "Arriba, el código corrige un tipo que no corresponde a los datos. Abajo, cuando ningún gráfico es válido, lo convierte en tabla.",
      },
      {
        tipo: "prosa",
        texto:
          "Si el modelo eligió un tipo que no está en ese conjunto, la regla lo cambia con una prioridad fija: línea si el eje es ordenado, barras si no, y después torta. La misma forma inválida recibe siempre la misma corrección. Si ningún tipo es válido, el gráfico se convierte en una tabla con una leyenda que lo dice.",
      },

      { tipo: "encabezado", texto: "Tres desenlaces, ninguno silencioso del todo" },
      {
        tipo: "prosa",
        texto:
          "Corregir el tipo no se anuncia, porque es consistencia y no un problema. Convertir a tabla sí se anuncia, porque cambia lo que se ve. Y la observación del juez semántico se muestra sin eliminar el gráfico, porque quitarlo escondería información.",
      },
      {
        tipo: "hallazgo",
        texto: "Corrige, degrada o marca, pero lo que sale nunca contradice sus datos.",
      },
      {
        tipo: "prosa",
        texto:
          "La regla vive en un solo sitio y la usan todos los que dibujan un gráfico: las secciones, las respuestas del chat y las diapositivas. Un mismo componente dibuja el contenido en los tres lugares, así que un gráfico se ve y se comporta igual venga de donde venga.",
      },
    ],
  },
  {
    slug: "streaming",
    numero: 8,
    acto: "fuente",
    titulo: "Que aparezca mientras se piensa",
    etapa: "Etapa · Presentación",
    conclusion:
      "Las secciones llegan una por una, completas y ya validadas, por un flujo de eventos que nada en medio puede retener.",
    bloques: [
      {
        tipo: "prosa",
        texto:
          "Transformar un documento tarda decenas de segundos. Para no dejar una pantalla vacía todo ese rato, las secciones aparecen una por una a medida que el modelo las termina, y mientras tanto un adelanto de una o dos frases resume de qué va el documento.",
      },
      {
        tipo: "prosa",
        texto:
          "El grano es la **sección completa**, nunca la palabra. Una sección a medias sería un objeto a medio construir que todavía podría no cumplir el contrato. Como cada sección se ancla y se corrige antes de salir, una que llega en vivo es idéntica a una que llegara al final.",
      },

      { tipo: "encabezado", texto: "Un flujo de eventos tipados" },
      {
        tipo: "prosa",
        texto:
          "La entrega usa eventos enviados por el servidor sobre una petición POST, porque la información va en un solo sentido. Los eventos tienen tipo: el título, cada sección con su anclaje, un evento final con el informe de anclaje y el veredicto sobre los gráficos, y uno de error. Con audio llega antes un evento con la transcripción.",
      },

      { tipo: "encabezado", texto: "Dos piezas que hacen posible el goteo" },
      {
        tipo: "prosa",
        texto:
          "La primera está en cómo escribe el modelo. Si la presentación saliera como los argumentos de una herramienta, la librería no podría entregar nada hasta tenerla entera. Por eso el agente escribe la presentación como JSON en texto, que se analiza a medida que llega, y cada sección se emite en cuanto está completa.",
      },
      {
        tipo: "prosa",
        texto:
          "La segunda está en el camino. El mecanismo de reenvío de Next.js guarda la respuesta completa antes de entregarla, lo que juntaría otra vez todas las secciones. Las rutas que transmiten pasan entonces por manejadores de ruta propios que devuelven el flujo tal cual, con cabeceras que piden a los intermediarios no retenerlo.",
      },
      {
        tipo: "figura",
        figura: "troceo",
        pie: "Cuándo llega cada sección por tres caminos. Por el reenvío de Next.js llegan todas juntas; por un manejador de ruta, una por una, como hablando directo con el backend.",
      },
      {
        tipo: "hallazgo",
        texto: "Que algo aparezca a tiempo depende de cada capa del camino, no solo de quien lo produce.",
      },
      {
        tipo: "prosa",
        texto:
          "La interfaz no se reorganiza cuando llega una sección. Las columnas solo se recalculan al abrir o cerrar un panel y al cambiar el tamaño de la ventana, así que nada salta de sitio durante la generación.",
      },
    ],
  },
  {
    slug: "fidelidad",
    numero: 9,
    acto: "trazabilidad",
    titulo: "Cuatro niveles de fidelidad",
    etapa: "Etapa · Presentación",
    conclusion:
      "El sistema no promete lo mismo para todas las fuentes: dice qué tan preciso es cada señalamiento y nunca finge el nivel siguiente.",
    bloques: [
      {
        tipo: "prosa",
        texto:
          "Al pulsar el pie de fuente de una sección se abre el documento original con el pasaje señalado. Lo que se puede señalar depende de la clase de fuente, y el sistema no promete lo mismo para todas sino lo que puede sostener en cada una. Y lo dice.",
      },
      {
        tipo: "figura",
        figura: "escalera-fidelidad",
        pie: "Los cuatro niveles, de más a menos preciso. Cada fuente llega hasta donde puede, y se declara dónde se quedó.",
      },
      {
        tipo: "tabla",
        cabeceras: ["Fuente", "Nivel", "Qué ve quien lee"],
        filas: [
          ["Texto", "Exacto", "El fragmento resaltado, verificado letra por letra"],
          ["PDF con capa de texto", "Región", "Un recuadro sobre la frase en la página dibujada; con borde discontinuo y un aviso si la ubicación es aproximada"],
          ["Audio", "Momento", "El reproductor salta al segundo de la cita y la transcripción la muestra resaltada"],
          ["PDF escaneado o imagen", "Página", "La página o la imagen completa"],
        ],
      },

      { tipo: "encabezado", texto: "Tres estados de anclaje" },
      {
        tipo: "prosa",
        texto:
          "Cada sección sale con uno de tres estados. **Verificado** quiere decir que la cita se encontró en el texto. **No encontrado**, que se buscó y no está. **Sin verificar**, que la fuente es un PDF, una imagen o un audio y no se puede comprobar sin aplanarla.",
      },
      {
        tipo: "prosa",
        texto:
          "Con texto, las posiciones se calculan contra la misma cadena que tiene el frontend, así que el resaltado cae exactamente donde debe. Cuando una cita no aparece, la sección no se descarta: pierde el botón de fuente y muestra un aviso que pide verificarla a mano. El aviso dice «no anclada» y no «inventada», porque el código no puede distinguir una paráfrasis fiel de una invención.",
      },

      { tipo: "encabezado", texto: "Localizar no es verificar" },
      {
        tipo: "prosa",
        texto:
          "El recuadro sobre un PDF lo dibuja un localizador de regiones, y eso parece contradecir la regla de no aplanar, porque para encontrar la frase hay que leer el texto del PDF. La diferencia está en el momento y en lo que devuelve: el modelo sigue recibiendo el archivo original, el localizador corre después de que la generación terminó, sobre una cita que el modelo ya escribió, y lo único que entrega son coordenadas.",
      },
      {
        tipo: "prosa",
        texto:
          "Busca la cita primero de forma exacta y después de forma aproximada, con un umbral prudente, porque un recuadro en el sitio equivocado es peor que ninguno. Si el pasaje ocupa más de 12 líneas o casi media página, vuelve al nivel de página. Localizar todas las secciones de un documento cuesta una fracción de segundo, así que cada sección llega con su región desde el primer momento.",
      },
      {
        tipo: "prosa",
        texto:
          "Encontrar la cita en el PDF o en la transcripción no cambia el estado, que sigue siendo sin verificar. Lo que se gana es poder señalar dónde mirar, no la garantía de que la afirmación corresponde a ese pasaje.",
      },
      {
        tipo: "hallazgo",
        texto: "Localizar no es verificar, y el estado no sube por haber localizado.",
      },
    ],
  },
  {
    slug: "preguntar",
    numero: 10,
    acto: "trazabilidad",
    titulo: "Preguntar sin perder el hilo",
    etapa: "Etapa · Chat anclado a fuentes",
    conclusion:
      "El chat relee el documento completo en cada pregunta, lo paga casi como si lo leyera una sola vez y ancla cada respuesta a su cita.",
    bloques: [
      {
        tipo: "prosa",
        texto:
          "El riesgo de una conversación larga con un modelo es que se vaya alejando del documento y mezcle lo que dice el original con lo que el modelo sabe por su cuenta, sin que nadie lo note. El chat está construido para que eso no pase en silencio.",
      },

      { tipo: "encabezado", texto: "El documento entero, en cada turno" },
      {
        tipo: "prosa",
        texto:
          "En cada pregunta el chat lee el documento original completo, no la presentación ni un resumen. Para no procesarlo de nuevo cada vez usa la caché de prefijos del proveedor: el documento va antes de un marcador y queda guardado, y cada pregunta solo procesa el historial y la pregunta nueva.",
      },
      {
        tipo: "figura",
        figura: "cache-chat",
        pie: "Lo que entra al modelo es igual en cada turno. Lo que cambia es cuánto se procesa de nuevo y cuánto se sirve desde la caché.",
      },
      {
        tipo: "prosa",
        texto:
          "La alternativa habitual es partir el documento en fragmentos y buscar los más parecidos a la pregunta. Se comparó con la lectura completa sobre documentos de 15 a 98 páginas, con recuperación por similitud y con dos variantes de recuperación por grafo. La lectura completa dio las respuestas más exactas, la recuperación por similitud quedó cerca y las de grafo bastante por debajo.",
      },
      {
        tipo: "figura",
        figura: "equilibrio",
        pie: "El costo por pregunta de leer el documento completo crece con sus páginas; el de recuperar fragmentos es plano. Las curvas se cruzan alrededor de las 30 páginas.",
      },
      {
        tipo: "prosa",
        texto:
          "En costo la respuesta depende del tamaño. Leer entero cuesta más a medida que el documento crece, y recuperar fragmentos cuesta lo mismo siempre. Pero el chat se usa con pocas preguntas por documento y en una sola sesión, donde la diferencia de costo es pequeña y la de exactitud se nota en cada respuesta, y por eso lee el documento completo.",
      },

      { tipo: "encabezado", texto: "Cada respuesta trae su cita, o dice que no la tiene" },
      {
        tipo: "prosa",
        texto:
          "El modelo propone una cita para cada respuesta y el código la valida con el mismo mecanismo que usan las secciones, así que queda verificada, sin verificar con su página o su momento, o no encontrada. Si el modelo no da cita, o la que da no existe, la interfaz dice que la respuesta no está anclada. Nunca se fabrica una cita.",
      },
      {
        tipo: "prosa",
        texto:
          "La respuesta toma la forma que pide la pregunta: un párrafo, una tabla, un gráfico o una línea de tiempo, con la misma unión de tipos del contrato y el mismo componente que dibuja las secciones.",
      },

      { tipo: "encabezado", texto: "Preguntar antes de adivinar" },
      {
        tipo: "prosa",
        texto:
          "Cuando una pregunta se puede entender de más de una manera, el chat pide una aclaración con opciones que se envían de un toque. Lo hace como mucho una vez por pregunta y con tendencia a responder, porque un chat que pregunta demasiado cansa más que uno que se equivoca un poco.",
      },
      {
        tipo: "prosa",
        texto:
          "Para la sección que se está leyendo se sugieren preguntas, pedidas en segundo plano, como invitación y no como obligación. También se puede dictar la pregunta por voz: el texto transcrito llena la caja, y la persona lo revisa y lo envía.",
      },
      {
        tipo: "hallazgo",
        texto: "Lo barato no era recortar el documento, era no volver a procesarlo.",
      },
    ],
  },
  {
    slug: "narracion",
    numero: 11,
    acto: "generado",
    titulo: "La narración y el adelanto",
    etapa: "Etapa · Narración, diapositivas y voz",
    conclusion:
      "La narración es una síntesis escrita para el oído, no una lectura de la pantalla, y nada suena sin que se pida.",
    bloques: [
      {
        tipo: "prosa",
        texto:
          "Hasta aquí todo lo que se muestra sale del documento y se puede rastrear hasta una frase. A partir de este capítulo aparecen piezas que el sistema genera aparte: una narración, unas ilustraciones y una presentación en diapositivas. Ninguna está en el original, y cada una está construida para que no se pueda confundir con él.",
      },

      { tipo: "encabezado", texto: "Un guion para escuchar" },
      {
        tipo: "prosa",
        texto:
          "La narración no lee las secciones en voz alta. Es un guion propio, escrito como una síntesis con su propio hilo, que toma los núcleos como columna vertebral y menciona que hay más detalle en el modo detallado. Así cumple el criterio de no repetir en el oído lo que ya está en la pantalla.",
      },
      {
        tipo: "prosa",
        texto:
          "El guion tiene entre 250 y 500 palabras, para que el servicio de voz no lo corte, y lo escribe el mismo modelo que estructura la presentación, releyendo el documento original. Se genera la primera vez que se pide y queda guardado para ese documento, así que volver a pedirlo no lo regenera.",
      },
      {
        tipo: "prosa",
        texto:
          "Nunca hay reproducción automática. Los controles de audio viven en la parte fija de la interfaz: un reproductor con barra de progreso, tiempo y saltos de 15 segundos.",
      },

      { tipo: "encabezado", texto: "El adelanto" },
      {
        tipo: "prosa",
        texto:
          "Mientras la presentación se genera, un modelo liviano escribe en paralelo un resumen de una o dos frases para que haya algo que leer desde el principio. Es independiente de la transformación: si falla, el adelanto se muestra como no disponible y la presentación sigue su curso.",
      },
      {
        tipo: "hallazgo",
        texto: "Nada suena sin que se pida, y lo que suena no repite la pantalla.",
      },
    ],
  },
  {
    slug: "generar-sin-mentir",
    numero: 12,
    acto: "generado",
    titulo: "Ilustraciones y diapositivas que no se confunden con el documento",
    etapa: "Etapa · Narración, diapositivas y voz",
    conclusion:
      "Lo que el sistema dibuja o resume por su cuenta lleva siempre la marca de generado, y no tiene dónde escribir una fuente.",
    bloques: [
      { tipo: "encabezado", texto: "Ilustraciones, solo con condiciones" },
      {
        tipo: "prosa",
        texto:
          "Generar imágenes choca con la trazabilidad, así que se hace con condiciones estrictas. Una sección recibe ilustración solo si el documento no trae imagen propia, si el contenido se beneficia de un apoyo visual (un proceso físico, un mecanismo espacial, una secuencia) y siempre como ayuda didáctica, nunca como prueba. Un modelo liviano aplica esa rúbrica, y hay un techo de cuatro ilustraciones por documento.",
      },
      {
        tipo: "prosa",
        texto:
          "La salvaguarda es estructural. Toda sección tiene fuente obligatoria, así que una ilustración metida entre los tipos de contenido tendría fuente y parecería verificada. Por eso vive fuera de la unión, en un campo de un tipo que no tiene campo de fuente, con una etiqueta fija que la declara generada y que acompaña a la imagen en todas partes.",
      },
      {
        tipo: "hallazgo",
        texto: "Lo que no puede tener fuente no puede fingir que la tiene.",
      },
      {
        tipo: "prosa",
        texto:
          "Las imágenes se piden sin texto dentro, porque los modelos de imagen escriben palabras con errores, y las etiquetas que hagan falta viven en la interfaz, donde se pueden leer. La regla va más allá de las letras:",
      },
      {
        tipo: "cita",
        texto:
          "La imagen debe entenderse sola; nada dentro de ella puede remitir a información que no esté dentro de ella.",
      },
      {
        tipo: "prosa",
        texto:
          "Pasos numerados, letras clave o líneas que apuntan a una leyenda inexistente dejan peor a quien no conoce el tema, que se pone a buscar una explicación que no está. El proveedor de imágenes se eligió midiendo, con las mismas instrucciones, cuál respetaba mejor esa regla.",
      },

      { tipo: "encabezado", texto: "Dos formas de ver diapositivas" },
      {
        tipo: "prosa",
        texto:
          "La **vista de diapositivas** no genera nada: recompone en láminas las secciones que ya existen, con su misma atribución. La **presentación generada** es otra cosa: relee el documento original y escribe un guion propio, independiente del de la narración. Llevan nombres distintos porque confundirlas sería confundir lo que se puede rastrear con lo que se sintetizó.",
      },
      {
        tipo: "prosa",
        texto:
          "En la presentación generada cada diapositiva declara su papel: apertura, afirmación, dato, comparación, cita, figura o cierre. Las de dato y de cita están obligadas a anclarse a una cita del documento, validada igual que en el chat. Las que simplifican sin una cita exacta se marcan como síntesis, sin fingir fuente.",
      },
      {
        tipo: "prosa",
        texto:
          "Una diapositiva puede llevar un gráfico, una tabla o una línea de tiempo, con el mismo componente y la misma regla de isomorfismo del resto, y lleva una imagen por cada cuatro diapositivas con la misma etiqueta de las ilustraciones. Como generarla con imágenes tarda un par de minutos, el conjunto se muestra cuando está completo, y queda guardado para ese documento.",
      },

      { tipo: "encabezado", texto: "Ver y generar, en sitios distintos" },
      {
        tipo: "prosa",
        texto:
          "En la interfaz, lo que solo cambia cómo se muestra lo existente (documento o diapositivas, resumido o detallado) está separado de lo que genera algo nuevo (la presentación y la narración). Generar vive en su propio panel, cada opción explica qué produce, y el botón dice en qué estado está mientras trabaja. Nada de esto corre solo al abrir un documento.",
      },
    ],
  },
  {
    slug: "interfaz",
    numero: 13,
    acto: "aplicacion",
    titulo: "Una interfaz que no cambia de sitio",
    etapa: "Etapa · Interfaz base",
    conclusion:
      "La estructura de la pantalla es fija, solo cambia la zona de contenido, y las columnas se reparten con una regla y no con plantillas.",
    bloques: [
      {
        tipo: "prosa",
        texto:
          "Una interfaz generada que mueve sus controles de una vez a otra obliga a buscarlos cada vez. Por eso la pantalla tiene dos partes. La **estructura fija** se monta una vez y no se mueve: el encabezado, el carril de navegación por secciones, los controles de nivel de detalle y de vista, el panel de generación y el acceso al chat. La **zona de contenido** es lo único que cambia.",
      },
      {
        tipo: "prosa",
        texto:
          "Cada sección es una tarjeta con su título, su contenido dibujado según el tipo, su rol y su pie de fuente. El modo resumido es el de partida, por el principio de revelación progresiva. El filtro que decide qué se ve es una función pura y tiene una salvaguarda: si una presentación no tuviera núcleos, muestra todo, para no dejar nunca la pantalla vacía.",
      },

      { tipo: "encabezado", texto: "Columnas por regla" },
      {
        tipo: "prosa",
        texto:
          "El documento fuente y el chat se abren como columnas junto al contenido. Cuántas caben no lo decide un catálogo de plantillas sino una regla con umbrales que solo mira qué paneles están abiertos y cuánto mide la ventana. Vive en una función con sus pruebas, no repartida por los componentes.",
      },
      {
        tipo: "figura",
        figura: "umbrales",
        pie: "La misma regla en tres anchos. El contenido conserva su sitio; lo que no cabe no se encoge, se oculta o se pone encima.",
      },
      {
        tipo: "prosa",
        texto:
          "En una pantalla ancha las dos columnas conviven con el contenido. En una mediana cabe una sola y se ve la que se abrió más recientemente; la otra sigue abierta y reaparece al ensanchar la ventana. En una estrecha los paneles se superponen al contenido, de uno en uno. En el teléfono el carril se convierte en una barra inferior que monta los mismos componentes.",
      },
      {
        tipo: "hallazgo",
        texto: "El contenido nunca se aplasta: cada umbral admite una columna más solo cuando cabe con un ancho legible.",
      },

      { tipo: "encabezado", texto: "Dos voces tipográficas" },
      {
        tipo: "prosa",
        texto:
          "Lo que viene del documento va en una tipografía con serifa, y lo que pone la herramienta (navegación, botones, etiquetas) en una sin serifa. Los números van en una monoespaciada tabular. Antes de leer una palabra ya se sabe si lo que hay delante sale del documento o lo pone la aplicación. Este relato usa el mismo código.",
      },
      {
        tipo: "prosa",
        texto:
          "El color del resaltador está reservado al rastro de verificación: la cita al pie de una sección, la de una respuesta del chat, la de una diapositiva y el pasaje marcado en el documento comparten componente y color. El borde discontinuo está reservado a lo generado o aproximado. Hay tema claro y oscuro, y todos los pares de texto y fondo se calcularon para superar el contraste mínimo de lectura en los dos.",
      },
    ],
  },
  {
    slug: "guardar",
    numero: 14,
    acto: "aplicacion",
    titulo: "Guardar y volver",
    etapa: "Fase 3 · Biblioteca",
    conclusion:
      "Sin cuenta todo funciona; con cuenta se guarda la presentación con su documento, su conversación y sus artefactos, y quién guardó qué nunca viaja a un modelo.",
    bloques: [
      {
        tipo: "prosa",
        texto:
          "El modo invitado no es una versión recortada. Sin cuenta se puede transformar, leer en los dos niveles, abrir fuentes, preguntar, escuchar y generar diapositivas. Iniciar sesión solo añade una cosa: guardar lo que hay en pantalla y volver a ello después, desde otro navegador si hace falta.",
      },

      { tipo: "encabezado", texto: "Qué se guarda" },
      {
        tipo: "prosa",
        texto:
          "Los documentos se identifican por su contenido, con un identificador derivado del hash del archivo, así que dos personas que suben el mismo PDF comparten la misma fila y los mismos bytes. Los bytes van a disco y no a la base de datos.",
      },
      {
        tipo: "prosa",
        texto:
          "La presentación se guarda como un bloque JSON con el número de versión del contrato, para que un cambio futuro del contrato no deje ilegible lo que ya estaba guardado. El historial del chat se ata a la presentación y no al usuario, porque sus respuestas apuntan a secciones de esa generación concreta. La narración y las diapositivas se guardan en lugar de regenerarse, porque regenerar daría un artefacto distinto cada vez. Una presentación guardada se puede eliminar, con opción de deshacer.",
      },

      { tipo: "encabezado", texto: "Quién guardó qué no cabe en el contrato" },
      {
        tipo: "prosa",
        texto:
          "La presentación viaja a los modelos, por ejemplo como base de la narración. Si llevara dentro el identificador de quien la guardó, ese dato terminaría en un prompt por un camino perfectamente normal. Por eso la propiedad vive solo en la base de datos.",
      },
      {
        tipo: "hallazgo",
        texto: "La propiedad no es parte del resultado: es parte del acto de guardarlo.",
      },
      {
        tipo: "prosa",
        texto:
          "Una presentación restaurada no trae el archivo original, y casi todo el sistema lo necesita. Todas las rutas que reciben un documento pasan por una sola función: si no llega archivo pero llega un identificador de documento, esa función carga los bytes guardados después de comprobar que pertenecen a quien los pide. Es el único sitio por donde se puede leer un documento guardado.",
      },
      {
        tipo: "figura",
        figura: "un-solo-sitio",
        pie: "Muchas rutas, una sola puerta. Lo que no pasa por ahí no puede leer un documento guardado.",
      },

      { tipo: "encabezado", texto: "La infraestructura, con su motivo" },
      {
        tipo: "tabla",
        cabeceras: ["Decisión", "Motivo"],
        filas: [
          ["SQLite con migraciones numeradas, sin mapeador de objetos", "Un servidor de base de datos aparte sería una pieza más que levantar y que puede fallar"],
          ["Sesiones guardadas en una tabla, no en tokens firmados", "Una fila se puede revocar; un token firmado sigue valiendo hasta que caduca"],
          ["Contraseñas con argon2 y cookie de sesión inaccesible desde la página", "Ni la base ni un script inyectado dejan ver una credencial"],
          ["Límite de intentos de inicio de sesión", "Probar contraseñas una tras otra deja de ser práctico"],
        ],
      },
      {
        tipo: "prosa",
        texto:
          "La autenticación es la de un prototipo y no pretende ser más: no hay verificación de correo ni recuperación de contraseña.",
      },
    ],
  },
  {
    slug: "telemetria",
    numero: 15,
    acto: "aplicacion",
    titulo: "Medir sin capturar contenido",
    etapa: "Etapa · Telemetría y endurecimiento del anclaje",
    conclusion:
      "La aplicación registra qué partes se usan y cuánto tiempo, nunca qué se lee ni qué se pregunta.",
    bloques: [
      {
        tipo: "prosa",
        texto:
          "Para entender cómo se usa la herramienta, la aplicación registra eventos de uso: el inicio y el fin de una sesión, la transformación, los cambios de nivel de detalle con el tiempo que se pasó en cada modo, el cambio entre la vista de documento y la de diapositivas, la apertura de la presentación generada, las preguntas sugeridas y escritas, y la apertura y el cierre de cada fuente con su estado y su origen.",
      },

      { tipo: "encabezado", texto: "Privacidad que no depende de la buena intención" },
      {
        tipo: "prosa",
        texto:
          "Ningún evento lleva contenido: ni el texto del documento ni el de las preguntas. Los eventos tampoco se atan a una cuenta, aunque haya una sesión iniciada, y hay pruebas que comprueban que un evento escrito con sesión abierta no contiene ni el correo ni el identificador de la cuenta. Si hace falta agrupar sesiones, se usa una etiqueta opcional en la dirección, que es un seudónimo y no una identidad.",
      },
      {
        tipo: "prosa",
        texto:
          "Leer la portada no abre una sesión de medición. La telemetría arranca cuando se entra a la aplicación, no al visitarla.",
      },

      { tipo: "encabezado", texto: "Que no se pierda por el camino" },
      {
        tipo: "prosa",
        texto:
          "Los eventos esperan en una cola guardada en el navegador y se envían por lotes cada pocos segundos. Salen de la cola solo cuando el servidor confirma que llegaron, así que un corte de red no los borra. Cada evento lleva un número de orden dentro de su sesión que no vuelve a empezar al recargar la página, y la hora de cada uno permite reconstruir el recorrido.",
      },
      {
        tipo: "prosa",
        texto:
          "En el servidor cada evento se valida por separado, para que uno malformado no arrastre al resto del lote, y se escribe en archivos que solo se pueden descargar con un token. Sin ese token, la ruta de descarga ni siquiera existe.",
      },
      {
        tipo: "hallazgo",
        texto: "Se mide qué se usa, nunca qué se lee.",
      },
    ],
  },
  {
    slug: "donde-vive",
    numero: 16,
    acto: "aplicacion",
    titulo: "Dónde vive",
    etapa: "Etapa · Despliegue y ajustes",
    conclusion:
      "Dos servicios y un volumen en internet, con el backend escondido detrás del frontend y topes de uso en lo que gasta modelos.",
    bloques: [
      {
        tipo: "prosa",
        texto:
          "La aplicación está en internet y se usa desde un navegador, también el de un teléfono, sin instalar nada. Corre en Railway como dos servicios, el frontend y el backend, más un volumen donde viven la base de datos, los documentos, las narraciones y la telemetría.",
      },
      {
        tipo: "prosa",
        texto:
          "Railway se eligió por tres cosas que esta aplicación necesita: un volumen persistente, una instancia que no se duerme y conexiones que se mantienen abiertas mientras fluyan datos, que es lo que pide la transmisión de secciones. Otras plataformas limitan el tamaño de una petición muy por debajo de los 20 MB que admite el sistema.",
      },

      { tipo: "encabezado", texto: "Una sola puerta" },
      {
        tipo: "prosa",
        texto:
          "Solo el frontend tiene dirección pública. El backend se alcanza por la red privada del proyecto, así que toda petición pasa primero por el frontend. Ahí se añaden las cabeceras de seguridad y una política de contenido que, en las páginas de la aplicación, solo deja ejecutar los scripts autorizados para esa petición concreta.",
      },
      {
        tipo: "prosa",
        texto:
          "Los puntos de entrada que consumen modelos tienen topes por hora, y el inicio de sesión tiene límite de intentos. Las claves de los proveedores viven en variables de entorno del servicio, nunca en el código ni en el repositorio.",
      },

      { tipo: "encabezado", texto: "Detalles que no son obvios" },
      {
        tipo: "tabla",
        cabeceras: ["Detalle", "Por qué"],
        filas: [
          ["La dirección del backend se fija al compilar el frontend", "Next.js guarda el destino de los reenvíos dentro del build, así que una variable puesta al arrancar llegaría tarde"],
          ["El backend escucha en IPv6", "La red privada de la plataforma puede ser IPv6, y escuchando solo en IPv4 el frontend no lo encontraría"],
          ["El contenedor arranca como administrador y baja de privilegios", "El volumen se monta a nombre del administrador; primero se ajusta el dueño y después se sirve sin privilegios"],
          ["La base se respalda con una copia coherente", "Copiar el archivo en caliente puede dar una copia que abre pero perdió lo último escrito"],
        ],
      },
      {
        tipo: "prosa",
        texto:
          "La misma aplicación se puede levantar entera en un computador con Docker Compose, con los dos servicios y el volumen igual que en internet.",
      },
    ],
  },
  {
    slug: "como-se-comprobo",
    numero: 17,
    acto: "aplicacion",
    titulo: "Cómo se comprobó",
    etapa: "Todas las etapas",
    conclusion:
      "Cada etapa se cerró con sus pruebas, las decisiones dudosas se midieron antes de tomarlas y la aplicación se probó con personas.",
    bloques: [
      {
        tipo: "prosa",
        texto:
          "El desarrollo avanzó por etapas, cada una con un objetivo, un resultado que se pudiera ver con el sistema corriendo y unos criterios de aceptación que había que cumplir antes de pasar a la siguiente. El orden siguió una regla sencilla: primero lo que las demás necesitaban. El contrato se probó antes de pedirle al modelo que lo llenara, y el flujo de texto a presentación funcionó de punta a punta antes de añadir formatos, niveles de lectura o atribución.",
      },

      { tipo: "encabezado", texto: "Pruebas automáticas" },
      {
        tipo: "prosa",
        texto:
          "Las dos partes tienen pruebas automáticas que crecieron con el sistema. Corren sin claves reales: el modelo se sustituye por uno falso que devuelve respuestas conocidas, para que nada dependa de un secreto. Las pruebas que llaman al modelo real están separadas y se corren a mano.",
      },
      {
        tipo: "prosa",
        texto:
          "La integración continua las ejecuta en cada cambio, junto con el linter y, en el frontend, la comprobación de tipos. Un cambio que rompe algo construido antes no pasa.",
      },

      { tipo: "encabezado", texto: "Más allá de las pruebas" },
      {
        tipo: "prosa",
        texto:
          "Cada etapa importante se verificó también con el modelo real y con documentos reales. Los fallos de punta a punta se provocaron a propósito para comprobar que terminan en un error visible. Y la aplicación se usó desde el teléfono y desde el navegador interno de una aplicación de mensajería, porque hay cosas que solo aparecen ahí.",
      },
      {
        tipo: "prosa",
        texto:
          "Dos decisiones no se tomaron por criterio sino con un experimento propio: leer el documento completo en el chat en lugar de recuperar fragmentos, y escuchar el audio en lugar de transcribirlo. En los dos se fijó de antemano que un resultado adverso se contaría tal cual.",
      },
      {
        tipo: "prosa",
        texto:
          "Por último, la aplicación se probó con personas, en sesiones individuales en las que cada una transformó un documento, lo exploró con libertad y después respondió preguntas sobre el contenido y sobre su experiencia.",
      },
      {
        tipo: "hallazgo",
        texto: "Una prueba en verde dice que lo probado funciona; por eso también se probó lo que solo aparece usándolo.",
      },
    ],
  },
];

export function capituloPorSlug(slug: string): Capitulo | undefined {
  return CAPITULOS.find((c) => c.slug === slug);
}
