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
    bloques: [],
  },
  {
    slug: "nunca-aplanar",
    numero: 2,
    acto: "cimiento",
    titulo: "Nunca aplanar la fuente",
    hitos: "Hitos 2 y 4",
    conclusion:
      "El PDF entra al modelo como PDF. Los parsers se evaluaron y se descartaron a propósito.",
    bloques: [],
  },
  {
    slug: "fidelidad",
    numero: 3,
    acto: "trazabilidad",
    titulo: "Decir solo lo que se puede probar",
    hitos: "5c · 8A.1 · resaltado por región",
    conclusion:
      "Cuatro niveles de fidelidad, y se declara el alcanzado sin fingir nunca el siguiente.",
    bloques: [],
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
