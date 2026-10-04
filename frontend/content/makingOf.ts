import type { Capitulo } from "@/lib/makingOf";

/**
 * El contenido del «making of», curado a mano desde el Registro de Hitos.
 *
 * **No se genera.** Es estático por tres razones, y la última es la que decide: cuesta lo mismo
 * que servir HTML, el autor controla exactamente qué dice, y —sobre todo— generarlo con un modelo
 * en cada visita sería lo único de este sistema que no se puede verificar. El making of argumenta
 * durante catorce capítulos que lo generado debe ser trazable a su fuente; generarlo al vuelo
 * contradiría su propia tesis en el acto.
 *
 * El Registro tiene 3.800 líneas con detalle de desarrollo. Esto es una síntesis: qué se
 * construyó, por qué, y qué apareció al medirlo. Las cifras salen del Registro, nunca se inventan.
 */
export const CAPITULOS: Capitulo[] = [
  {
    slug: "contrato",
    numero: 1,
    acto: "cimiento",
    titulo: "El hueco que no puede volver a abrirse",
    hitos: "Hitos 0-2",
    conclusion:
      "El error del prototipo anterior no se corrigió: se volvió imposible de escribir.",
    bloques: [
      {
        tipo: "prosa",
        texto:
          "Había un prototipo antes de este proyecto, y tenía un fallo que no daba la cara. Una sección llevaba dos campos: `content_type`, que decía de qué era, y `content`, que lo guardaba. Eran campos hermanos, y nada los obligaba a coincidir.",
      },
      {
        tipo: "prosa",
        texto:
          "Se podía declarar `content_type=\"chart\"` y guardar en `content` una cadena de texto cualquiera. Pasaba la validación sin una queja. El error aparecía mucho después, al dibujar, cuando ya era imposible saber de dónde había salido.",
      },
      {
        tipo: "prosa",
        texto:
          "La reacción natural es añadir una validación que compruebe que los dos campos están de acuerdo. **Eso es lo que no se hizo**, y es la decisión que sostiene todo lo demás.",
      },

      { tipo: "encabezado", texto: "Quitar una pieza, no añadir una" },
      {
        tipo: "prosa",
        texto:
          "No existe un campo `content_type` suelto. El discriminador vive **dentro** del propio bloque de contenido, y `content` es una unión discriminada: el tipo declarado y el contenido real no son dos cosas que haya que mantener sincronizadas, son el mismo objeto.",
      },
      {
        tipo: "figura",
        figura: "hueco-contrato",
        pie: "Cerrar el hueco quitó una pieza en vez de añadir una. A la derecha hay una caja menos, no una más.",
      },
      {
        tipo: "hallazgo",
        texto: "Un estado inválido que no se puede representar no hace falta validarlo.",
      },
      {
        tipo: "prosa",
        texto:
          "Es la idea que vuelve en cada hito de este relato. En el capítulo 3 impedirá declarar una fidelidad que no se alcanzó; en el 4, dibujar un gráfico que contradice sus datos; en el 13, que la identidad de quien guarda se cuele en el contrato que viaja a los modelos.",
      },
      {
        tipo: "prosa",
        texto:
          "A la misma lógica responden los conjuntos cerrados. `SectionRole` es `core` o `satellite` y nada más; `ChartType` es `line`, `bar`, `pie` o `scatter`. Ninguno es texto libre. Y todos los modelos llevan `extra=\"forbid\"`: un campo que no se esperaba no se ignora, se rechaza.",
      },

      { tipo: "encabezado", texto: "La mitad importante son los rechazos" },
      {
        tipo: "prosa",
        texto:
          "El contrato trae ==13 pruebas==, y **once de ellas comprueban que algo se rechaza**. Dos comprueban que lo correcto pasa. Esa proporción no es casual: un contrato se define por lo que no deja escribir.",
      },
      {
        tipo: "tabla",
        cabeceras: ["Lo que se intenta escribir", "Resultado"],
        filas: [
          ["Un gráfico cuyo contenido es una cadena de texto", "rechazado"],
          ["Un gráfico sin tipo de gráfico ni datos", "rechazado"],
          ["Un texto que además lleva campos de gráfico", "rechazado"],
          ["Un tipo de contenido que no existe", "rechazado"],
          ["Una fila de tabla más ancha que sus columnas", "rechazado"],
          ["Una sección sin fuente, o sin papel de núcleo o satélite", "rechazado"],
          ["Una cita cuyo final va antes que su principio", "rechazado"],
          ["Una presentación sin ninguna sección", "rechazado"],
        ],
        nota: "La primera fila es el fallo del prototipo. Es la prueba que este hito existe para poder escribir.",
      },
      {
        tipo: "prosa",
        texto:
          "La atribución entra aquí y no más tarde: cada sección lleva una `SourceReference` **obligatoria**, con la cita exacta y sus posiciones. No se añadió cuando hizo falta resaltar; estaba en el contrato desde antes de que existiera una interfaz que la usara. Un campo opcional se habría quedado vacío en la mitad de los caminos, y a los tres hitos habría sido tarde para exigirlo.",
      },
      {
        tipo: "prosa",
        texto:
          "El precio hay que decirlo: el contrato es rígido y cada capacidad nueva tiene que negociar con él. Se verá en el capítulo 3, cuando añadir el recuadro sobre la frase y el segundo exacto del audio obligó a campos hermanos antes que a tocar `SourceReference`. Esa rigidez es el coste de que el hueco siga cerrado.",
      },
    ],
  },
  {
    slug: "nunca-aplanar",
    numero: 2,
    acto: "cimiento",
    titulo: "Nunca aplanar la fuente",
    hitos: "Hitos 2 y 4",
    conclusion:
      "El PDF entra al modelo como PDF. Los parsers se evaluaron y se descartaron a propósito.",
    bloques: [
      {
        tipo: "prosa",
        texto:
          "El prototipo leía los PDF con `pypdf`: sacaba el texto y trabajaba con el texto. Es lo que hace casi todo el mundo, y durante años fue lo único que se podía hacer.",
      },
      {
        tipo: "prosa",
        texto:
          "El problema no es que el texto extraído sea peor. Es que **le faltan cosas**, y no avisa de cuáles.",
      },
      {
        tipo: "figura",
        figura: "aplanar",
        pie: "El mismo documento por dos caminos. Arriba la rejilla de la tabla se perdió y del gráfico no queda nada; abajo llega entero.",
      },
      {
        tipo: "prosa",
        texto:
          "Una tabla aplanada deja de ser una tabla: las celdas se convierten en una línea corrida de palabras y números en la que ya no se sabe qué cifra iba con qué fila. Un gráfico no deja ni eso — no hay texto que extraer, así que simplemente no aparece. Dos columnas se entrelazan. Un pie de figura acaba pegado al párrafo de al lado.",
      },
      {
        tipo: "hallazgo",
        texto: "Un parser destruye justo aquello que un modelo multimodal está hecho para leer.",
      },

      { tipo: "encabezado", texto: "Se evaluaron, y se descartaron" },
      {
        tipo: "prosa",
        texto:
          "No se descartaron de oídas. Estaban en el inventario de herramientas del proyecto y se miraron: convierten el documento a Markdown o a texto, que es exactamente la operación que había que evitar. La decisión quedó escrita junto al código, con su motivo, para que nadie la reabra por comodidad tres meses después.",
      },
      {
        tipo: "prosa",
        texto:
          "El PDF y la imagen llegan al modelo como **binario nativo**, sin intermediario. Un parser solo volvería a considerarse para documentos que no quepan en el contexto del modelo, y **nunca en el camino que va al modelo**.",
      },
      {
        tipo: "prosa",
        texto:
          "La misma operación se repitió dos veces más. En el capítulo 7, transcribir un audio es aplanar una señal acústica a texto, y por eso ese formato ganó una fase de percepción en vez de un transcriptor. En el capítulo 5, el chat relee el documento entero en lugar de buscar en un resumen, porque un resumen ya descartó lo que quizá vas a preguntar. Es el mismo principio tres veces.",
      },

      { tipo: "encabezado", texto: "Lo que entra sin preguntar es lo que te rompe" },
      {
        tipo: "prosa",
        texto:
          "Aceptar archivos de fuera obligó a poner guardas que el prototipo no tenía, y ninguna se fía de lo que dice el cliente:",
      },
      {
        tipo: "tabla",
        cabeceras: ["Guarda", "Cómo", "Si falla"],
        filas: [
          ["Tipo real del archivo", "por los bytes de cabecera, no por la extensión", "415"],
          ["Tamaño", "leído por trozos de 1 MB, abortando al pasarse", "413"],
          ["Duración del audio", "medida antes de llamar a nadie", "413"],
          ["Archivo vacío o corrupto", "comprobado antes de tocar el modelo", "400"],
        ],
        nota: "Los topes son ==20 MB== y ==15 minutos==, y están en la configuración, no incrustados en el código.",
      },
      {
        tipo: "prosa",
        texto:
          "Leer por trozos y abortar al pasarse, en vez de leer entero y después medir, es la diferencia entre rechazar un archivo de 2 GB y quedarse sin memoria por culpa de él. La lista de tipos permitidos es blanca, no negra: lo que no está, no entra.",
      },
      {
        tipo: "prosa",
        texto:
          "Y la consecuencia incómoda, que es de donde sale el capítulo siguiente. Si el documento no se aplana a texto, **no hay texto contra el que comprobar una cita**. La verificación por coincidencia exacta, que funciona con un texto pegado, deja de ser posible en cuanto la fuente es un binario. Eso obligó a decir la verdad sobre qué se sabe de cada cita en vez de fingir que todas valen lo mismo.",
      },
    ],
  },
  {
    slug: "fidelidad",
    numero: 3,
    acto: "trazabilidad",
    titulo: "Decir solo lo que se puede probar",
    hitos: "5c · 8A.1 · resaltado por región",
    conclusion:
      "Cuatro niveles de fidelidad, y se declara el alcanzado sin fingir nunca el siguiente.",
    bloques: [
      {
        tipo: "prosa",
        texto:
          "Cualquier sistema de estos puede poner una cita debajo de lo que escribe. Lo difícil no es ponerla: es que signifique siempre lo mismo.",
      },
      {
        tipo: "prosa",
        texto:
          "Con un texto pegado, comprobar una cita es buscarla. O está, carácter por carácter, o no está. En cuanto la fuente es un PDF, una grabación o una foto, esa comprobación deja de existir, porque no hay texto plano contra el que buscar — y aplanarlo para poder buscar sería deshacer el capítulo anterior.",
      },
      {
        tipo: "prosa",
        texto:
          "La salida fácil habría sido poner la cita igual en los cuatro casos y no decir nada. Se hizo lo contrario: **cada cita declara qué se sabe de ella**.",
      },
      {
        tipo: "figura",
        figura: "escalera-fidelidad",
        pie: "Cuatro entradas, cuatro pruebas de distinta fuerza. Solo la primera lleva el resaltador, porque es la única donde «comprobada» es literal.",
      },

      { tipo: "encabezado", texto: "Tres estados, y el que no existe" },
      {
        tipo: "prosa",
        texto:
          "Los estados son `verified`, `not_found` y `unverified`, y la distinción importante es la segunda contra la tercera. `not_found` significa **se buscó y no está**: es una alarma real, la cita no sale del documento. `unverified` significa **no se pudo buscar**: no hay nada malo, hay algo que no se sabe.",
      },
      {
        tipo: "prosa",
        texto:
          "Confundir los dos sería el peor fallo posible en este sistema, en las dos direcciones. Enseñar un PDF como si estuviera verificado promete algo que nadie comprobó; enseñarlo como fallo asusta por una limitación nuestra. Por eso la interfaz muestra `unverified` en neutro, sin color de error.",
      },
      {
        tipo: "prosa",
        texto:
          "Y lo que pasa con `not_found` es lo que de verdad define al proyecto: **la sección pierde la fuente**. No se enseña una cita que no se pudo anclar, ni se deja el enlace puesto confiando en que nadie lo pulse. Es la diferencia entre decir «no pude verificar esto» y fingir que sí.",
      },
      {
        tipo: "hallazgo",
        texto: "Localizar no es verificar, y el estado no cambia por haber localizado.",
      },
      {
        tipo: "prosa",
        texto:
          "Esa frase decidió el diseño del cuarto nivel. Cuando se añadió el recuadro sobre la frase en un PDF, la tentación era ascender esas citas a `verified`: al fin y al cabo se había encontrado el pasaje en la página. Pero encontrar dónde está no demuestra que diga lo que la sección afirma. El estado se quedó en `unverified` y lo que se añadió fue **dónde**, no **cuánto**.",
      },

      { tipo: "encabezado", texto: "Añadir sin tocar lo que ya está" },
      {
        tipo: "prosa",
        texto:
          "El recuadro del PDF y el segundo exacto del audio son dos capacidades distintas que llegaron en momentos distintos, y las dos entraron igual: como un **campo hermano**, nunca metiéndose dentro de `SourceReference`. La región no es una propiedad de la cita; es algo que se sabe de ella en una fuente concreta.",
      },
      {
        tipo: "prosa",
        texto:
          "Hay un detalle del contrato que vale por toda la idea: **no existe el valor «página»**. La fidelidad de página es la AUSENCIA del campo de región. Así el estado contradictorio —«solo sé la página» y aun así traer recuadros dentro— no se puede ni escribir. Es el capítulo 1, aplicado tres hitos después.",
      },

      { tipo: "encabezado", texto: "El umbral, y el caso que lo rompía" },
      {
        tipo: "prosa",
        texto:
          "Localizar una cita en una página no es buscar una cadena: el modelo reescribe espacios, comillas y guiones. Se compara de forma difusa, con un umbral de ==90 sobre 100==, y por debajo de ahí se prefiere no dibujar nada antes que dibujar un recuadro sobre la frase equivocada.",
      },
      {
        tipo: "prosa",
        texto:
          "Un caso real se colaba por debajo. Cuando el modelo cita con puntos suspensivos —«…a una altitud tan alta… que no representan…»— y se busca la frase entera, la parte elidida hunde la puntuación: ==78 puntos== frente al umbral de 90. Se perdía una localización que era exacta.",
      },
      {
        tipo: "prosa",
        texto:
          "La solución no fue bajar el umbral, que habría dejado pasar aciertos falsos en todas partes. Se parte la cita **por sus puntos suspensivos** y se busca cada trozo. No relaja nada: la elipsis está diciendo que ahí hay un hueco, y recuadrar los dos trozos sin lo de en medio es más fiel que un único recuadro que se lo tragaría todo.",
      },
      {
        tipo: "prosa",
        texto:
          "El capítulo 14 recoge lo que esta escalera deja fuera, y hay que decirlo aquí también: un PDF escaneado se queda en la página, porque señalar la frase pediría reconocer el texto dentro de la imagen y eso no se hace. Y una imagen devuelve la cita y nada más. Son los dos peldaños de abajo, y están dibujados en la figura con el mismo tamaño que los de arriba a propósito.",
      },
    ],
  },
  {
    slug: "forma-y-datos",
    numero: 4,
    acto: "trazabilidad",
    titulo: "La forma sigue a los datos",
    hitos: "Hito 5a",
    conclusion:
      "Un gráfico no puede contradecir la forma de sus datos: si el modelo se equivoca, se corrige en código.",
    bloques: [],
  },
  {
    slug: "preguntar",
    numero: 5,
    acto: "trazabilidad",
    titulo: "Preguntar sin perder el hilo",
    hitos: "Hito 6 · Opción D",
    conclusion:
      "El chat relee el documento entero en cada turno, y lo paga una sola vez.",
    bloques: [],
  },
  {
    slug: "rag",
    numero: 6,
    acto: "midiendo",
    titulo: "¿Hacía falta RAG?",
    hitos: "Hito 7",
    conclusion:
      "A escala de documento gana el camino simple. Y el punto de equilibrio que publiqué primero estaba mal.",
    bloques: [],
  },
  {
    slug: "audio",
    numero: 7,
    acto: "midiendo",
    titulo: "Lo que el audio trae, y lo que se pierde al transcribir",
    hitos: "Pieza A1",
    conclusion:
      "De tres capacidades evaluadas solo una cambia el resultado, por una razón estructural.",
    bloques: [
      {
        tipo: "prosa",
        texto:
          "Un compromiso del anteproyecto decía que el sistema aceptaría audio. El sistema aceptaba PDF, imágenes y texto. Cerrar ese hueco parecía trivial: hay transcriptores excelentes, se pasa el audio por uno y se trata el resultado como un documento de texto más.",
      },
      {
        tipo: "prosa",
        texto: "Eso es exactamente lo que el proyecto no podía hacer.",
      },
      {
        tipo: "prosa",
        texto:
          "Dos hitos antes se había descartado aplanar un PDF a texto, porque un parser destruye justo lo que un modelo multimodal está hecho para leer. Transcribir un audio es la misma operación: sustituir la fuente por un derivado más pobre antes de que nadie la interprete. Y había un obstáculo adicional, que no era de principios sino de la API: **el motor de estructuración no admite audio como modalidad de entrada.**",
      },

      { tipo: "encabezado", texto: "La fase que no existía" },
      {
        tipo: "prosa",
        texto:
          "La salida fue delegar **solo la percepción** a un modelo que sí oye, y que no devuelve una transcripción sino una anotación estructurada: quién habla, qué se enfatiza, dónde hay titubeo, qué eventos no verbales ocurren, en qué condiciones acústicas.",
      },
      {
        tipo: "figura",
        figura: "pipeline-audio",
        pie: "El audio gana una fase previa. Todo lo demás entra por donde entraba.",
      },
      {
        tipo: "prosa",
        texto:
          "El motor que estructura no cambió ni una palabra de su instrucción de sistema. Lo que entra es más rico que un texto, no más pobre.",
      },

      { tipo: "encabezado", texto: "Qué aporta eso de verdad" },
      {
        tipo: "prosa",
        texto:
          "La pregunta no se respondió razonando. Se grabaron ==ocho clips==, se pasaron por dos condiciones (transcripción plana contra anotación estructurada) con el mismo estructurador y el mismo contrato, y se midió con tres criterios deterministas, sin juez.",
      },
      {
        tipo: "tabla",
        cabeceras: ["", "énfasis → núcleo", "duda matizada", "cifra firme intacta", "hablantes atribuidos"],
        filas: [
          ["Transcripción plana", "3/3", "0/1", "2/2", "0/2"],
          ["Anotación estructurada", "3/3", "1/1", "2/2", "2/2"],
        ],
        nota: "Ocho clips grabados por el autor, 1,98 minutos de audio. Una repetición: son señales, no tasas.",
      },
      {
        tipo: "prosa",
        texto:
          "**La fila que importa es la última, y el hallazgo no es de grado.** La transcripción devuelve un bloque corrido, sin marcas de turno:",
      },
      {
        tipo: "cita",
        texto:
          "Según el cierre de agosto, la rotación de personal fue el 12%. A mí me salió distinto. Yo tengo 15%, pero yo estoy contando también los contratos temporales.",
      },
      {
        tipo: "prosa",
        texto:
          "El estructurador no puede atribuir lo que no está en su entrada. No es que lo haga peor: **no puede**. La anotación separa los dos turnos, y cada cifra queda con su dueño.",
      },
      {
        tipo: "hallazgo",
        texto: "La información no se degrada al aplanar: se pierde.",
      },
      {
        tipo: "prosa",
        texto:
          "Es el principio rector del proyecto con evidencia propia, y es la frase que esta pieza existe para poder decir.",
      },

      { tipo: "encabezado", texto: "Y lo que no aporta, dicho igual de claro" },
      {
        tipo: "prosa",
        texto:
          "**El énfasis no cambia nada medible.** El modelo sí lo oye: anotó la frase enfatizada en los tres clips diseñados para ello. Pero la presentación que sale no es distinta de forma que la medida detecte, por dos razones, y la segunda es un límite de la medición.",
      },
      {
        tipo: "prosa",
        texto:
          "La primera: lo enfatizado suele ser además lo más llamativo léxicamente. Si alguien subraya «el 42 %» en un informe de tres cifras, esa cifra acaba en una sección principal aunque nadie la subraye.",
      },
      {
        tipo: "prosa",
        texto:
          "La segunda: la medida comprueba que la frase esté en una sección principal, no que haya quedado destacada sobre las demás. Medir prominencia relativa exigiría un juicio, y con él su varianza.",
      },
      {
        tipo: "prosa",
        texto:
          "Hay un dato cualitativo que empuja en contra: en ese clip, el título que produjo la condición con percepción enumeró las tres cifras en vez de privilegiar la enfatizada. **Resultado nulo, declarado como nulo.** Coincide con lo que la literatura anticipa para contenido informativo.",
      },

      { tipo: "encabezado", texto: "El contrapeso" },
      {
        tipo: "prosa",
        texto:
          "La atribución de hablantes es donde esta pieza gana. Es también donde está su peor modo de fallo.",
      },
      {
        tipo: "prosa",
        texto:
          "En un clip con ruido de fondo continuo y **una sola voz**, el modelo reportó ==dos hablantes==, partió el audio en dos turnos y justificó el corte. Todo con confianza alta.",
      },
      {
        tipo: "prosa",
        texto:
          "En un sistema cuya propuesta de valor es la trazabilidad, atribuir una idea a alguien que no existe es peor que no atribuirla. No lo detectó ninguna de las tres medidas: apareció leyendo la anotación a mano.",
      },

      { tipo: "encabezado", texto: "Dos controles que hacen creíble lo anterior" },
      {
        tipo: "prosa",
        texto:
          "**Un clip plano, donde lo correcto era no anotar nada.** Existía para detectar invención. Salió con cero énfasis, cero duda, cero eventos. No inventó nada.",
      },
      {
        tipo: "prosa",
        texto:
          "**Un clip de ruido que se grabó dos veces y nunca funcionó como instrumento.** La idea era tapar una cifra hasta volverla ininteligible. Ni el transcriptor ni el modelo la perdieron, las dos veces. La conclusión no es sobre la grabación: a niveles de ruido que una persona todavía entiende, ninguno de los dos falla. Para activar esa capacidad haría falta un ruido con el que un oyente humano tampoco entendería el número, y ahí el clip deja de representar el caso de uso.",
      },
      {
        tipo: "hallazgo",
        texto: "No hubo una tercera toma. Repetir hasta obtener el resultado esperado sería perseguir un resultado, no medirlo.",
      },

      { tipo: "encabezado", texto: "Lo que cuesta y dónde está el techo" },
      {
        tipo: "tabla",
        cabeceras: ["", "Medido"],
        filas: [
          ["Percepción", "~$0,017 por minuto de audio"],
          ["Un audio de 5 minutos", "~$0,08"],
          ["Tope admitido", "15 minutos"],
        ],
      },
      {
        tipo: "prosa",
        texto:
          "El tope no es prudencia: es aritmética. La anotación crece con la duración (==3.551 tokens de salida por minuto de habla==, medidos) y el techo de salida del modelo son ==65.536==. Eso pone el límite real en ~18,5 minutos. Los 15 dejan margen para audio más denso, porque un truncamiento se manifiesta como un error opaco justo en el caso predecible.",
      },
      {
        tipo: "prosa",
        texto:
          "Un podcast de una hora necesitaría ~213.000 tokens de salida. **No es caro: es imposible.** Atenderlo no es subir un número, es trocear el audio en ventanas y unir anotaciones, con sus propias preguntas. Queda declarado, no resuelto a medias.",
      },
    ],
  },
  {
    slug: "generar-sin-mentir",
    numero: 8,
    acto: "midiendo",
    titulo: "Generar sin mentir",
    hitos: "5g · 5h · 5j · diagnóstico de imágenes",
    conclusion:
      "El sistema genera ilustraciones, diapositivas y narración, y ninguna puede confundirse con el documento.",
    bloques: [],
  },
  {
    slug: "streaming",
    numero: 9,
    acto: "usable",
    titulo: "Que aparezca mientras se piensa",
    hitos: "Hito 5d",
    conclusion:
      "Dos mediciones cambiaron la arquitectura del streaming. Ninguna de las dos se adivinó.",
    bloques: [],
  },
  {
    slug: "columnas",
    numero: 10,
    acto: "usable",
    titulo: "Dos escalas que no se mezclan",
    hitos: "Hito 5e",
    conclusion:
      "La convivencia de columnas es una regla determinista con umbrales, no un catálogo de plantillas.",
    bloques: [],
  },
  {
    slug: "la-piel",
    numero: 11,
    acto: "usable",
    titulo: "La piel",
    hitos: "Hito 5k",
    conclusion:
      "Un rediseño que no tocó la arquitectura, y que empezó por medir por qué la anterior se sentía plana.",
    bloques: [],
  },
  {
    slug: "telemetria",
    numero: 12,
    acto: "usable",
    titulo: "Medir sin molestar",
    hitos: "Hito 8A · 8A.1",
    conclusion:
      "Revisar el instrumento antes de usarlo encontró un contador roto en 7 de 11 sesiones ya grabadas.",
    bloques: [],
  },
  {
    slug: "guardar",
    numero: 13,
    acto: "usable",
    titulo: "Guardar y volver",
    hitos: "Login y persistencia",
    conclusion:
      "Quién guardó qué vive fuera del contrato de datos, porque el contrato viaja a los modelos.",
    bloques: [],
  },
  {
    slug: "lo-que-no-se-hizo",
    numero: 14,
    acto: "cierre",
    titulo: "Lo que no se hizo, y por qué",
    hitos: "Todo el proyecto",
    conclusion:
      "La lista completa de limitaciones declaradas. Es el capítulo que sostiene a los trece anteriores.",
    bloques: [],
  },
];

export function capituloPorSlug(slug: string): Capitulo | undefined {
  return CAPITULOS.find((c) => c.slug === slug);
}
