import type { Capitulo } from "@/lib/makingOf";

/**
 * El contenido del «making of», curado a mano desde el Registro de Hitos.
 *
 * **No se genera.** Es estático por tres razones, y la última es la que decide: cuesta lo mismo
 * que servir HTML, el autor controla exactamente qué dice, y (sobre todo) generarlo con un modelo
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
          "Una tabla aplanada deja de ser una tabla: las celdas se convierten en una línea corrida de palabras y números en la que ya no se sabe qué cifra iba con qué fila. Un gráfico no deja ni eso, no hay texto que extraer, así que simplemente no aparece. Dos columnas se entrelazan. Un pie de figura acaba pegado al párrafo de al lado.",
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
          "Con un texto pegado, comprobar una cita es buscarla. O está, carácter por carácter, o no está. En cuanto la fuente es un PDF, una grabación o una foto, esa comprobación deja de existir, porque no hay texto plano contra el que buscar, y aplanarlo para poder buscar sería deshacer el capítulo anterior.",
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
          "Hay un detalle del contrato que vale por toda la idea: **no existe el valor «página»**. La fidelidad de página es la AUSENCIA del campo de región. Así el estado contradictorio («solo sé la página» y aun así traer recuadros dentro) no se puede ni escribir. Es el capítulo 1, aplicado tres hitos después.",
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
          "Un caso real se colaba por debajo. Cuando el modelo cita con puntos suspensivos («…a una altitud tan alta… que no representan…») y se busca la frase entera, la parte elidida hunde la puntuación: ==78 puntos== frente al umbral de 90. Se perdía una localización que era exacta.",
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
    bloques: [
      {
        tipo: "prosa",
        texto:
          "Un gráfico mal elegido no es un problema estético. Una serie de años dibujada como tarta dice que las partes suman un todo, y no lo hacen: dice algo falso sobre los datos, en un lenguaje que se lee antes que el texto.",
      },
      {
        tipo: "prosa",
        texto:
          "El modelo escoge el tipo de gráfico a la vez que inventa los datos, y a veces escoge mal. La pregunta es qué se hace entonces.",
      },
      {
        tipo: "prosa",
        texto:
          "Lo habitual es pedírselo mejor: añadir al prompt una frase que explique cuándo usar cada tipo. Eso convierte una garantía en una súplica. **Lo que se hizo fue sacar la decisión del modelo y meterla en código.**",
      },

      { tipo: "encabezado", texto: "La forma de los datos manda" },
      {
        tipo: "prosa",
        texto:
          "Antes de dibujar nada, una regla mira la forma de los datos (si las series están alineadas, si los números son finitos, si el eje tiene un orden, cuántas categorías hay, si todo es positivo) y devuelve el conjunto de tipos que esa forma admite. Sin modelo, sin juicio, sin prompt.",
      },
      {
        tipo: "tabla",
        cabeceras: ["Tipo", "Cuándo lo admite la forma"],
        filas: [
          ["barra", "siempre que los datos estén alineados y sean finitos"],
          ["línea", "si el eje tiene un orden y hay al menos dos puntos"],
          ["tarta", "una sola serie, no negativa, eje SIN orden, entre 2 y 8 categorías"],
          ["dispersión", "nunca: pide pares (x, y) que esta forma de datos no modela"],
        ],
        nota: "La tarta exige que el eje NO esté ordenado. Una progresión en el tiempo no son partes de un todo, y es el caso que más veces se elige mal.",
      },
      {
        tipo: "prosa",
        texto:
          "Si el tipo que pidió el modelo está en el conjunto, se respeta. Si no, se corrige al mejor admisible, con una prioridad fija: eje ordenado → línea; si no, barra; si no, tarta. **Misma forma inválida, misma corrección, siempre.**",
      },
      {
        tipo: "figura",
        figura: "isomorfismo",
        pie: "Dos desenlaces. Arriba el tipo se corrige en silencio; abajo no hay ningún gráfico posible y se dice.",
      },

      { tipo: "encabezado", texto: "Cuando no hay gráfico posible" },
      {
        tipo: "prosa",
        texto:
          "El caso que casi nadie implementa es el segundo. Si los datos vienen desalineados (tres categorías y dos valores) o traen un infinito, el conjunto de tipos admisibles queda **vacío**. No hay gráfico correcto que dibujar.",
      },
      {
        tipo: "prosa",
        texto:
          "Entonces la sección se convierte en tabla, que es la forma que nunca miente sobre unos datos, y lleva una leyenda visible diciendo qué pasó. Los datos no se tiran: la tabla los conserva, categoría a categoría.",
      },
      {
        tipo: "hallazgo",
        texto: "Nunca falla en silencio: corrige, degrada o marca. Pero lo que sale nunca contradice sus datos.",
      },
      {
        tipo: "prosa",
        texto:
          "La diferencia entre corregir y degradar está en quién se entera. Corregir el tipo es silencioso a propósito, porque es consistencia y no un aviso: al lector no le aporta saber que el modelo pidió otra cosa. Degradar sí se dice, porque lo que ve es distinto de lo que esperaba. Son dos casos distintos y llevan dos nombres distintos en el contrato, `corrected` y `degraded`.",
      },

      { tipo: "encabezado", texto: "Un matiz que no se suavizó" },
      {
        tipo: "prosa",
        texto:
          "La regla **no restringe de antemano** lo que el modelo puede pedir: lo corrige después. Sería más elegante impedir la elección mala desde el principio, pero el modelo genera los datos y el tipo en la misma respuesta, así que no hay un «antes» en el que la forma de los datos ya se conozca.",
      },
      {
        tipo: "prosa",
        texto:
          "El efecto final es el mismo (el tipo que sale siempre está dentro de lo válido) y el camino está escrito tal cual en el Registro en vez de contado como si la regla fuera preventiva. ==10 pruebas== cubren la regla: que acepta lo válido, que corrige lo inválido, y que la corrección es siempre la misma.",
      },
      {
        tipo: "prosa",
        texto:
          "Encima de esto hay una segunda capa, esta sí con modelo: un agente compara los gráficos contra el documento y marca incoherencias de significado, no de forma. **Esa capa está implementada y probada con el modelo simulado, pero no se ha confirmado con el modelo real**, y así figura en el Registro. Marca, nunca borra: una observación semántica no elimina un gráfico.",
      },
    ],
  },
  {
    slug: "preguntar",
    numero: 5,
    acto: "trazabilidad",
    titulo: "Preguntar sin perder el hilo",
    hitos: "Hito 6 · Opción D",
    conclusion:
      "El chat relee el documento entero en cada turno, y lo paga una sola vez.",
    bloques: [
      {
        tipo: "prosa",
        texto:
          "El chat podría responder leyendo la presentación que ya se generó. Está ahí, está estructurada, y es mucho más corta que el documento. Sería lo barato.",
      },
      {
        tipo: "prosa",
        texto:
          "Pero esa presentación es **una selección**: separó lo esencial del detalle y dejó cosas fuera a propósito. Preguntarle a un resumen es preguntarle a alguien que ya decidió qué no te iba a contar, y lo que no contó es exactamente lo que quizá vas a preguntar.",
      },
      {
        tipo: "prosa",
        texto:
          "Es el principio del capítulo 2 otra vez, en otro sitio: no sustituir la fuente por un derivado más pobre antes de que nadie la interprete. Así que el chat **relee el documento original completo en cada turno**.",
      },

      { tipo: "encabezado", texto: "Y se paga una sola vez" },
      {
        tipo: "prosa",
        texto:
          "La objeción obvia es el coste: mandar el documento entero en cada pregunta. La respuesta no fue recortarlo, fue cachearlo. Lo que entra al modelo se arma siempre igual ( el documento, un marcador, y después el historial con la pregunta ) y el marcador separa lo estable de lo nuevo.",
      },
      {
        tipo: "figura",
        figura: "cache-chat",
        pie: "Las dos barras miden lo mismo: el documento entero entra en los dos turnos. Lo que cambia es si se procesa o se lee de caché.",
      },
      {
        tipo: "tabla",
        cabeceras: ["Turno", "entrada", "escritura de caché", "lectura de caché"],
        filas: [
          ["1 · escribe la caché", "3253", "3223", "0"],
          ["2 · lee la caché", "3298", "0", "3223"],
        ],
        nota: "Medido con el modelo real sobre un documento de unos 2.600 caracteres. Del segundo turno en adelante el documento se sirve desde caché, a alrededor del 10 % del coste del input.",
      },
      {
        tipo: "prosa",
        texto:
          "Dos límites que van con la cifra y no se separan de ella: el proveedor **no cachea prefijos por debajo de unos 1.024 tokens**, así que un documento corto no activa nada y el ahorro solo se ve en documentos medianos o largos; y la caché dura unos cinco minutos por turno. Una conversación con pausas largas vuelve a pagar el documento.",
      },
      {
        tipo: "hallazgo",
        texto: "Lo barato no era recortar el documento, era no volver a procesarlo.",
      },

      { tipo: "encabezado", texto: "Cada respuesta trae su cita, o dice que no la tiene" },
      {
        tipo: "prosa",
        texto:
          "La atribución del capítulo 3 se extiende a cada turno, y por el mismo camino: el modelo da la cita, y **el código la ancla**, con la misma función que usa la transformación. No hay un segundo mecanismo de verificación para el chat.",
      },
      {
        tipo: "prosa",
        texto:
          "Si el modelo no da cita, o la da y no existe en el documento, la respuesta sale marcada como no anclada y sin fuente. Se dice en la interfaz, con esas palabras. **Nunca se fabrica una cita para que la respuesta parezca respaldada.**",
      },
      {
        tipo: "prosa",
        texto:
          "La respuesta tampoco es siempre un párrafo: el modelo elige el tipo de contenido de la misma unión del capítulo 1, así que una pregunta por unas cifras puede devolver una tabla o un gráfico, dibujados con los mismos componentes que la presentación. No hay un segundo sistema de render, y por tanto la regla del capítulo 4 también los vigila.",
      },
      {
        tipo: "prosa",
        texto:
          "El texto se escribe en vivo mientras el modelo piensa, pero **la cita y los componentes llegan al final, ya completos y validados**. Enseñar un ancla a medias sería enseñar algo que todavía puede resultar falso.",
      },

      { tipo: "encabezado", texto: "Preguntar antes de adivinar" },
      {
        tipo: "prosa",
        texto:
          "Una mejora que estaba apuntada desde el diseño y se activó después: ante una pregunta **genuinamente ambigua**, el sistema pide una aclaración en vez de adivinar con la misma seguridad que si fuera clara. Dos condiciones, y ninguna más: un referente que el historial no resuelve, o dos lecturas distintas con respuestas distintas.",
      },
      {
        tipo: "prosa",
        texto:
          "La calibración era todo el problema, porque algo así se vuelve insoportable si se dispara de más. Tiene **sesgo por defecto a responder** (ante preguntas cortas, informales o con erratas, responde; ante la duda, responde) y pide aclaración **a lo sumo una vez**: si el turno anterior ya fue una aclaración, contesta con la mejor interpretación. No hay ciclos.",
      },
      {
        tipo: "prosa",
        texto:
          "Se probó con el modelo real sobre un documento con dos métodos de café, donde «¿y el otro?» o «¿cuánto café se usa?» son ambiguas de verdad. ==Cuatro de cuatro== ambiguas pidieron aclaración con opciones concretas; ==cuatro de cuatro== normales respondieron ancladas.",
      },
      {
        tipo: "prosa",
        texto:
          "Y lo que no salió redondo, que también se midió: en una pregunta de frontera el criterio **varió entre corridas** (una vez aclaró, otra respondió). La variación cae del lado seguro, que es responder, porque esto es una invitación y nunca un muro: el campo de texto no se bloquea nunca y se puede ignorar la pregunta y reescribir.",
      },
      {
        tipo: "prosa",
        texto:
          "Queda una deuda dicha en su sitio: el historial del chat vivía solo en la memoria de la pestaña y se perdía al recargar. Fue una decisión temporal, aislada en un único sitio para que el hito de guardar y volver (el capítulo 13) la reemplazara sin tocar nada más. Eso es lo que acabó pasando.",
      },
    ],
  },
  {
    slug: "rag",
    numero: 6,
    acto: "midiendo",
    titulo: "¿Hacía falta RAG?",
    hitos: "Hito 7",
    conclusion:
      "A escala de documento gana el camino simple. Y el punto de equilibrio que publiqué primero estaba mal.",
    bloques: [
      {
        tipo: "prosa",
        texto:
          "El capítulo 5 defiende releer el documento entero en cada pregunta. Es lo contrario de lo que casi todo el mundo construye: lo normal es trocear el documento, indexarlo y recuperar solo los trozos que parecen relevantes. A eso se le llama RAG, y a la versión con grafo de conceptos, GraphRAG.",
      },
      {
        tipo: "prosa",
        texto:
          "No bastaba con razonarlo. Se montó un experimento aparte del producto para medirlo, con una regla escrita antes de empezar: **si un sistema rinde peor, se reporta tal cual; nada se ajusta para que gane el que querríamos que ganara.**",
      },
      {
        tipo: "prosa",
        texto:
          "Cuatro condiciones con el mismo generador y el mismo prompt, solo cambia de dónde sale el contexto. Tres documentos de 15, 47 y 98 páginas, treinta preguntas, ==120 corridas, cero errores==.",
      },

      { tipo: "encabezado", texto: "En calidad gana el camino simple" },
      {
        tipo: "tabla",
        cabeceras: ["Condición", "exactitud", "recuperación"],
        filas: [
          ["Línea base · el documento entero", "0,987", "ve todo"],
          ["RAG vectorial multimodal", "0,953", "0,889"],
          ["LightRAG naive", "0,553", "0,370"],
          ["LightRAG con grafo", "0,323", "0,167"],
        ],
        nota: "Exactitud media sobre 30 preguntas, ya con el dataset corregido. Un juez automático de la misma familia que el generador, que es una limitación declarada más abajo.",
      },
      {
        tipo: "prosa",
        texto:
          "El RAG vectorial queda cerca y es una alternativa viable. El del grafo queda lejos, y hay una explicación que no lo deja peor de lo que es: su contexto sintetizado mapea mal a las páginas originales, así que su puntuación está **confundida con un fallo de recuperación** y no es solo un juicio sobre su razonamiento.",
      },

      { tipo: "encabezado", texto: "Y en coste la respuesta es otra" },
      {
        tipo: "prosa",
        texto:
          "Aquí es donde publiqué una cifra equivocada. La primera versión decía que indexar **solo se amortiza tras unas 267 preguntas por documento**: un umbral tan alto que daba a entender que el camino simple era además siempre el más barato.",
      },
      {
        tipo: "prosa",
        texto:
          "Estaba mal por dos órdenes de magnitud, y al revés justo donde la pregunta importa. Tres errores encadenados, y ninguno era de medición: los datos crudos estaban bien.",
      },
      {
        tipo: "tabla",
        cabeceras: ["El error", "Qué hacía"],
        filas: [
          ["Mezclar escalas", "comparaba la indexación de LOS TRES documentos contra un ritmo de preguntas de UNO"],
          ["Coste equivocado", "usaba la indexación total, dominada por el grafo, que el RAG vectorial no necesita para nada"],
          ["Promedio global", "un único coste por pregunta, cuando varía 4× según el tamaño del documento"],
        ],
      },
      {
        tipo: "prosa",
        texto:
          "La raíz del tercero es lo que de verdad enseña este capítulo. **El coste por pregunta de la línea base escala con el documento**, porque manda el documento completo aunque esté cacheado. El del RAG vectorial es plano: recupera unas pocas páginas, mida lo que mida el original. Dos pendientes distintas se cruzan.",
      },
      {
        tipo: "figura",
        figura: "equilibrio",
        pie: "Las tres mediciones reales. Por debajo del cruce la línea base es más barata por pregunta; por encima lo es el vectorial, y su índice cuesta céntimos.",
      },
      {
        tipo: "tabla",
        cabeceras: ["Documento", "páginas", "base $/preg", "vectorial $/preg", "se amortiza en"],
        filas: [
          ["Attention", "15", "0,0277", "0,0484", "nunca: la base ya es más barata"],
          ["Juan Valdez", "47", "0,0742", "0,0480", "~1,2 preguntas"],
          ["Decreto 1016", "98", "0,1045", "0,0582", "~1,7 preguntas"],
        ],
        nota: "Recalculado desde los 120 registros crudos, sin regenerar nada y sin llamar a ninguna API: `experiments/breakeven.py` lo reproduce entero. El caché funcionó (27 de las 30 preguntas de la línea base LEYERON caché) así que son costes de uso real, no inflados.",
      },
      {
        tipo: "hallazgo",
        texto: "No era un umbral de 267 preguntas: era una o dos, en cuanto el documento pasa de unas 30 páginas.",
      },
      {
        tipo: "prosa",
        texto:
          "**Esto corrige la conclusión, no solo una cifra.** La afirmación de que el camino simple era también el más barato hasta un umbral inalcanzable no se sostiene para documentos de 47 páginas o más.",
      },

      { tipo: "encabezado", texto: "Por qué la decisión se mantiene igual" },
      {
        tipo: "prosa",
        texto:
          "El sistema trabaja con documentos de 10 a 100 páginas, de forma conversacional, con pocas preguntas por documento y en una sola sesión. Ahí la diferencia de coste son céntimos, y la de exactitud (0,987 contra 0,953) se nota en cada respuesta.",
      },
      {
        tipo: "prosa",
        texto:
          "Así que se elige el camino simple **por calidad y por simplicidad, no por coste**. Y decirlo así es más defendible que apoyarse en un umbral que no existía.",
      },

      { tipo: "encabezado", texto: "Y una auditoría del propio dataset" },
      {
        tipo: "prosa",
        texto:
          "Más tarde se auditaron las treinta preguntas contra los tres PDF. Lo que apareció fue que **la pasada de validación manual que el propio dataset anunciaba en su cabecera nunca se había ejecutado**, y cinco marcadores de «(VALIDAR)» llegaron literalmente al generador y al juez como si fueran contenido.",
      },
      {
        tipo: "prosa",
        texto:
          "De ahí salieron dos problemas con impacto medido. El primero es metodológico y es el más interesante: **la métrica de las preguntas sin respuesta premiaba el fallo de recuperación.** El juez solo comprobaba que el sistema dijera «no está en el documento», sin comprobar que hubiera buscado. Medido: el modo grafo sacó un 1,0 perfecto en dos preguntas **recuperando cero páginas**, su peor modo de fallo, disfrazado de acierto.",
      },
      {
        tipo: "cita",
        texto:
          "«No recuperé nada, luego no está» no puede puntuar igual que «recuperé y verifiqué la ausencia».",
      },
      {
        tipo: "prosa",
        texto:
          "El segundo era un *gold* falso: una pregunta sobre una gráfica de barras afirmaba que la compañía estaba por encima del promedio, cuando la gráfica muestra tres dimensiones por encima, una por debajo y una empatada. **Penalizaba a tres de los cuatro sistemas por leer la gráfica bien.**",
      },
      {
        tipo: "prosa",
        texto:
          "Se re-juzgaron solo ==16 registros== de 120, sin regenerar una sola respuesta: lo que cambió fue el criterio y el *gold*, no lo que dijeron los sistemas. Costó ==$0,0137==, frente a los $9,65 del experimento entero.",
      },
      {
        tipo: "prosa",
        texto:
          "**El orden no cambió** ( base, vectorial, naive, grafo ) pero la corrección honestiza la historia en las dos direcciones: el empate de todos en las preguntas sin respuesta era un artefacto de la métrica, y la penalización en las preguntas visuales la producía un *gold* equivocado y no los sistemas.",
      },

      { tipo: "encabezado", texto: "Lo que este experimento no demuestra" },
      {
        tipo: "prosa",
        texto:
          "Las amenazas a la validez van aparte y ninguna se esconde: **una sola repetición**, así que no hay medida de varianza; el juez es de la misma familia que el generador y no de otro proveedor; la muestra es pequeña (tres documentos, treinta preguntas) y señala tendencias sin cerrar el tema; el documento de 98 páginas hubo que comprimirlo para entrar en el límite del proveedor.",
      },
      {
        tipo: "prosa",
        texto:
          "Y una tensión que vale la pena nombrar porque contradice al capítulo 2: para indexar con grafo **hubo que aplanar las páginas a texto**. Solo en el índice; la respuesta final nunca ve texto aplanado. Pero es aplanar, y está dicho.",
      },
    ],
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
    bloques: [
      {
        tipo: "prosa",
        texto:
          "Hasta aquí todo lo que el sistema produce sale del documento y se puede rastrear hasta una frase. Tres piezas rompen eso a propósito: una ilustración dibujada, una presentación con su propio guion, y una narración en voz. Ninguna de las tres está en el original.",
      },
      {
        tipo: "prosa",
        texto:
          "La decisión de Fase 2 era tajante: **el sistema NO genera imágenes nuevas**, porque chocaría con la trazabilidad. Esa decisión se reabrió, y conviene decirlo así en vez de presentarla como si nunca hubiera existido.",
      },

      { tipo: "encabezado", texto: "Reabrir una decisión, con condiciones" },
      {
        tipo: "prosa",
        texto:
          "Se modificó de forma acotada: se genera una ilustración **solo** si el documento de esa sección no trae imagen propia, si el contenido se beneficia de verdad de un apoyo visual (un proceso físico, un mecanismo espacial) y entendiendo que es una ayuda didáctica y nunca una prueba. El motivo real es simple: hay documentos que no traen una sola imagen.",
      },
      {
        tipo: "prosa",
        texto:
          "La salvaguarda no es una etiqueta de buena voluntad, es **una imposibilidad estructural**, y salió de un hallazgo al diseñar el esquema. Toda `Section` tiene fuente obligatoria, así que meter la ilustración como un tipo más del contenido le habría dado fuente, es decir, la habría hecho confundible con contenido verificado.",
      },
      {
        tipo: "prosa",
        texto:
          "La solución fue dejarla **fuera de la unión**: un campo opcional aparte, de un tipo que **no tiene campo de fuente en absoluto**. No es que su atribución esté vacía; es que no se puede escribir. Y lleva una etiqueta fija en el propio tipo, no en la interfaz: «Ilustración de apoyo (generada, no proviene del documento)».",
      },
      {
        tipo: "hallazgo",
        texto: "Lo que no puede tener fuente no puede fingir que la tiene. Es el capítulo 1 otra vez, cuatro hitos después.",
      },
      {
        tipo: "prosa",
        texto:
          "Y un techo: la rúbrica decide cuántas, pero hay un **tope de seguridad de 4 por documento** en el código, que acota el peor caso de coste. En la práctica la rúbrica da una o dos. Verificado con un documento sobre la formación del granizo: marcó solo la sección del proceso y **excluyó la conceptual**.",
      },

      { tipo: "encabezado", texto: "El texto dentro de las imágenes, y la hipótesis que falló" },
      {
        tipo: "prosa",
        texto:
          "Había una regla desde el principio: las imágenes se generan **sin texto**, y las etiquetas viven en el HTML, donde se pueden leer y traducir. Aun así seguían apareciendo palabras inventadas dentro de las ilustraciones: «Flcn», «Nirrequco Nǫrecdearo dnandadl».",
      },
      {
        tipo: "prosa",
        texto:
          "Lo primero fue comprobar que la regla estuviera aplicada, antes de medir nada. Lo estaba, **en las tres capas**: en el clasificador, en el bloque de estilo y en la instrucción negativa del proveedor. Así que el problema no era una regla olvidada sino cómo estaba formulada, y se encontraron cinco debilidades que se suman.",
      },
      {
        tipo: "prosa",
        texto:
          "La más interesante: **se pedía un «diagrama»**, que es el único género que en los datos de entrenamiento lleva etiquetas siempre. Se pedía justo la cosa que implica texto y después se prohibía el texto. A eso se sumaban la instrucción en español cuando el proveedor recomienda inglés, la prohibición enterrada tras sesenta palabras, y la palabra «legibilidad» en la misma frase que prohíbe las letras.",
      },
      {
        tipo: "prosa",
        texto:
          "Se arreglaron los cinco a la vez y se volvió a medir con seis contenidos, usando los prompts que genera el clasificador real y no escritos a mano.",
      },
      {
        tipo: "figura",
        figura: "tandas-imagen",
        pie: "Las dos primeras filas son idénticas: cinco cambios razonados en la instrucción no movieron la tasa.",
      },
      {
        tipo: "hallazgo",
        texto: "No es que la instrucción estuviera mal escrita: el modelo la ignora con una frecuencia que no baja reformulándola.",
      },
      {
        tipo: "prosa",
        texto:
          "La hipótesis barata se probó y se descartó con datos, que es para lo que sirve medir. Lo que sí movió la aguja fue **cambiar de proveedor**: el mismo prompt, en otro modelo, salió limpio, y el caso que en el primero salía lleno de garabatos salió además mejor dibujado. De paso resultó más barato que el que estaba, y sin clave nueva.",
      },
      {
        tipo: "prosa",
        texto:
          "La honestidad estadística va pegada: **seis casos por tanda**. Un 3 de 6 frente a un 0 de 6 es orientativo, no establecido. Lo que lo sostiene es que la evidencia cualitativa apunta igual y que el peor caso se reprodujo dos veces.",
      },

      { tipo: "encabezado", texto: "La regla se apretó, y eso desmintió el resultado" },
      {
        tipo: "prosa",
        texto:
          "Al revisar la batería apareció algo que el diagnóstico no había visto. **No basta con que no haya texto.** Una imagen con pasos numerados, o con letras clave, o con líneas guía, remite a una leyenda que no existe, y eso deja **peor** a quien no conoce el tema que no poner nada, porque se pone a buscar una explicación que no está en ninguna parte.",
      },
      {
        tipo: "cita",
        texto:
          "La imagen debe entenderse sola; nada dentro de ella puede remitir a información que no esté dentro de ella.",
      },
      {
        tipo: "prosa",
        texto:
          "Y eso **corrigió el resultado de esta misma investigación**. La imagen del café que se había contado como válida numeraba los pasos del (1) al (7), así que no lo era: el proveedor nuevo pasó de 0 de 6 a ==1 de 6== bajo el criterio correcto. Con la regla reescrita y los clasificadores prohibidos de pedir pasos numerados, la misma batería dio ==0 de 6==, y el caso del café muestra ahora la secuencia colocando las etapas en orden con flechas.",
      },
      {
        tipo: "prosa",
        texto:
          "**Residuo honesto:** en el caso de la tormenta quedaron unas marcas de escala sin valores en el borde. Es la misma categoría de referencia huérfana, mucho menos dañina que una palabra inventada, pero no es cero absoluto y no se cuenta como si lo fuera.",
      },

      { tipo: "encabezado", texto: "Las otras dos, y lo que cuestan" },
      {
        tipo: "prosa",
        texto:
          "La presentación en diapositivas y la narración en voz son la misma idea terminando en dos sitios: una síntesis didáctica del documento, escrita **desde el original** y no desde el resumen ya generado, por el mismo motivo del capítulo 5.",
      },
      {
        tipo: "prosa",
        texto:
          "Hay además una vista de diapositivas que **no genera nada**: recompone las secciones ya verificadas, con su misma atribución, y cuesta cero. Son dos cosas distintas y llevan nombres distintos, porque confundirlas sería confundir lo trazable con lo generado.",
      },
      {
        tipo: "tabla",
        cabeceras: ["Lo que produce", "coste real"],
        filas: [
          ["Una narración completa, guion y voz", "0,0455"],
          ["Una ilustración de apoyo", "0,167"],
          ["Una presentación generada entera", "0,52"],
          ["La vista de diapositivas de lo ya generado", "0"],
        ],
        nota: "En dólares, medido. Todo se cachea por documento: volver a pedir lo mismo no regenera nada.",
      },
      {
        tipo: "prosa",
        texto:
          "Las tres se piden a mano y ninguna corre sola al abrir un documento. Un sistema que genera por su cuenta cosas que no están en la fuente es exactamente lo que este proyecto se pasa catorce capítulos evitando.",
      },
    ],
  },
  {
    slug: "streaming",
    numero: 9,
    acto: "usable",
    titulo: "Que aparezca mientras se piensa",
    hitos: "Hito 5d",
    conclusion:
      "Dos mediciones cambiaron la arquitectura del streaming. Ninguna de las dos se adivinó.",
    bloques: [
      {
        tipo: "prosa",
        texto:
          "Transformar un documento tarda entre veinte y sesenta segundos. Esperar ese rato delante de una pantalla en blanco es insoportable, así que las secciones aparecen **una por una**, a medida que el modelo las termina.",
      },
      {
        tipo: "prosa",
        texto:
          "El grano se decidió antes de construir nada: **por sección completa**, nunca palabra por palabra. Una sección a medias sería JSON a medio construir, es decir contenido que todavía puede no validar, y este proyecto no enseña nada que no haya pasado por el contrato. Antes de emitir cada sección se la ancla y se le aplica la regla de los gráficos, así que **una sección que llega en vivo es indistinguible de una que llega al final**.",
      },

      { tipo: "encabezado", texto: "Primera medición: salía todo de golpe" },
      {
        tipo: "prosa",
        texto:
          "Con el modelo real no funcionaba. El indicador decía «Generando… 0 secciones» y de pronto aparecía el bloque entero. El código del streaming estaba bien; lo que fallaba estaba más abajo.",
      },
      {
        tipo: "prosa",
        texto:
          "La causa se diagnosticó, no se supuso: el agente pedía su salida como **llamada a herramienta**. Con ese modo, toda la presentación viaja como los argumentos de una sola herramienta, y la librería no puede entregar nada hasta que esa llamada está **completa**. No había parciales que trocear, ni siquiera el título.",
      },
      {
        tipo: "tabla",
        cabeceras: ["Modo de salida", "título", "secciones", "parciales"],
        filas: [
          ["salida por herramienta", "7,31 s", "las 4 de golpe a 7,31 s", "1"],
          ["salida por texto", "3,03 s", "1 → 3 → 4 a 3,0 / 4,7 / 5,3 s", "10"],
        ],
        nota: "Una sola llamada, medida dentro del proceso. El título llega en menos de la mitad de tiempo, y lo hace porque hay parciales que entregar.",
      },
      {
        tipo: "prosa",
        texto:
          "El cambio tiene un precio y está dicho: la salida por herramienta daba una garantía de esquema del proveedor algo más fuerte. Pero sin parciales no hay streaming, y con la validación y los reintentos de la librería el JSON sale bien de forma fiable. **El agente entero cambió de modo**, no solo el camino con streaming: dos modos distintos serían dos comportamientos que mantener sincronizados.",
      },

      { tipo: "encabezado", texto: "Segunda medición: el proxy lo volvía a juntar" },
      {
        tipo: "prosa",
        texto:
          "Arreglado eso, el backend troceaba. Pero el navegador no habla con el backend directamente: pasa por el servidor del frontend. Y ahí se volvía a juntar todo.",
      },
      {
        tipo: "figura",
        figura: "troceo",
        pie: "Cuatro puntos en la misma vertical: por el camino de en medio las secciones llegaban juntas, aunque el backend las mandara separadas.",
      },
      {
        tipo: "prosa",
        texto:
          "La regla de reescritura del framework **bufferiza** el flujo y lo entrega de una vez. Es un detalle de infraestructura que no aparece en ningún diagrama de arquitectura, y que convertía en inútil todo el trabajo anterior. Se reemplazó por un manejador de ruta propio que devuelve el flujo tal cual, con las cabeceras que piden a los intermediarios que no lo transformen.",
      },
      {
        tipo: "hallazgo",
        texto: "Dos capas distintas podían anular el streaming, y ninguna de las dos se veía desde el código del streaming.",
      },
      {
        tipo: "prosa",
        texto:
          "Esa es la lección del capítulo, y vuelve en el 12 con la telemetría: **algo puede estar correctamente construido y aun así no funcionar**, porque lo que falla está en una capa que nadie estaba mirando. Verlo exige medir contra el sistema corriendo, no releer el código.",
      },

      { tipo: "encabezado", texto: "La limitación que esto deja" },
      {
        tipo: "prosa",
        texto:
          "El troceo incremental está verificado con el proveedor primario. Con el de respaldo **puede no darse**: las secciones llegarían casi de golpe al final, y el streaming se degradaría a un único bloque tardío.",
      },
      {
        tipo: "prosa",
        texto:
          "Es una limitación real de ser agnóstico del modelo, y está documentada en vez de forzada. La interfaz no se rompe (el render es el mismo) pero la experiencia sería peor, y conviene decirlo antes de que alguien lo descubra solo.",
      },
    ],
  },
  {
    slug: "columnas",
    numero: 10,
    acto: "usable",
    titulo: "Dos escalas que no se mezclan",
    hitos: "Hito 5e",
    conclusion:
      "La convivencia de columnas es una regla determinista con umbrales, no un catálogo de plantillas.",
    bloques: [
      {
        tipo: "prosa",
        texto:
          "Había un apretón concreto: con el chat siempre visible, abrir el panel de fuente dejaba el contenido en una franja ilegible. Tres columnas peleando por el mismo ancho.",
      },
      {
        tipo: "prosa",
        texto:
          "La salida habitual es un catálogo de plantillas: una para cada combinación de paneles y de tamaño. Envejece mal ( cada panel nuevo multiplica los casos ) y nadie puede predecir qué va a pasar sin mirarse la lista.",
      },
      {
        tipo: "prosa",
        texto:
          "Aquí es **una regla con umbrales**, y es lógica pura: depende solo de qué paneles están abiertos y de cuánto mide la ventana. Vive en una función con sus pruebas, no repartida por los componentes.",
      },
      {
        tipo: "figura",
        figura: "umbrales",
        pie: "El contenido conserva su sitio en los tres anchos. Lo que no cabe no se encoge: se oculta o se pone encima.",
      },
      {
        tipo: "prosa",
        texto:
          "El criterio cuando solo cabe una columna es **la más reciente**: la que acabas de abrir es la que se ve. Es predecible sin explicarlo, porque coincide con lo que acabas de hacer. La otra no se cierra (sigue abierta en el estado) y reaparece sola al ensanchar la ventana.",
      },
      {
        tipo: "hallazgo",
        texto: "El contenido nunca se aplasta: cada umbral admite una columna más solo cuando cabe con ancho legible.",
      },
      {
        tipo: "prosa",
        texto:
          "Y está comprobado con números, no a ojo: a 1440 px, el nav de 240 más el contenido de 464 más la fuente de 416 más el chat de 320 suman exactamente 1440, sin desbordar. A 800 px el chat pasa a superponerse y el contenido se queda con sus 560 completos.",
      },

      { tipo: "encabezado", texto: "Una cosa que no se cableó, y se dice" },
      {
        tipo: "prosa",
        texto:
          "El hito tenía dos escalas. La segunda es ésta. La primera era componer **dentro** de una sección: un gráfico y su tabla de apoyo lado a lado, por ejemplo.",
      },
      {
        tipo: "prosa",
        texto:
          "No se pudo, y el motivo es bonito: el contrato del capítulo 1 dice que una sección tiene **exactamente un** bloque de contenido. Esa es justamente la decisión que cerró el hueco original. Componer varios tipos dentro de una sección exigiría tocar el contrato, y el hito se había prohibido tocarlo.",
      },
      {
        tipo: "prosa",
        texto:
          "Así que la Escala 1 quedó como **especificación escrita y no cableada**, con su jerarquía de peso visual decidida (gráfico, tabla, línea de tiempo, texto, por huella espacial decreciente) lista para el día que el contrato gane secciones de varios bloques. **Cero deuda oculta:** está anotada, no olvidada.",
      },
      {
        tipo: "prosa",
        texto:
          "Un detalle que parece menor y no lo es: el layout **solo recalcula al abrir o cerrar un panel y al redimensionar**, nunca al llegar una sección nueva por el streaming del capítulo 9. Si dependiera del contenido, las columnas bailarían durante toda la generación.",
      },
    ],
  },
  {
    slug: "la-piel",
    numero: 11,
    acto: "usable",
    titulo: "La piel",
    hitos: "Hito 5k",
    conclusion:
      "Dos rediseños. El primero arregló lo que medí; el segundo, lo que no se me ocurrió medir.",
    bloques: [
      {
        tipo: "prosa",
        texto:
          "La identidad anterior se sentía plana. «Se siente plana» no es un diagnóstico: es una impresión, y a partir de una impresión se eligen colores nuevos hasta que la impresión cambie. Así que primero se midió por qué.",
      },
      {
        tipo: "tabla",
        cabeceras: ["Lo que se midió", "valor", "qué implicaba"],
        filas: [
          ["Acento contra el texto", "1,42:1", "un estado activo se leía como otro gris"],
          ["El acento como texto, en oscuro", "2,15:1", "por debajo de lo legible"],
          ["Familia de base y acento", "la misma", "sin contraste de temperatura"],
          ["Niveles de superficie", "2", "sin profundidad que ordenara las capas"],
        ],
        nota: "Tres causas concretas y medibles detrás de una sola impresión. Con eso ya se puede decidir qué cambiar.",
      },
      {
        tipo: "prosa",
        texto:
          "La respuesta fue **neutros cálidos con un acento frío**. El contraste de temperatura es el que da la profundidad que faltaba, y no depende de subir la saturación. El acento se reserva a lo interactivo o activo, y un estado activo se marca con un lavado de ese acento y texto en acento, no con un bloque relleno.",
      },
      {
        tipo: "hallazgo",
        texto: "Todos los pares de texto y fondo superan 4,5:1, en claro y en oscuro. Calculado, no estimado a ojo.",
      },

      { tipo: "encabezado", texto: "Y meses después, el mismo capítulo otra vez" },
      {
        tipo: "prosa",
        texto:
          "Todo lo anterior sigue siendo verdad, y aun así **la respuesta estaba mal**. El diagnóstico era correcto (faltaba contraste de temperatura) y la solución resolvió el problema medido. Lo que no vi es hacia dónde lo resolvía.",
      },
      {
        tipo: "prosa",
        texto:
          "Lo dijo el autor del proyecto mirando la aplicación terminada: *«está bonito, pero parece un producto de Anthropic»*. Y tenía razón. **Papel crema con serifa para el cuerpo es, literalmente, la casa de Claude**, es así como se componen sus respuestas. La guía de diseño que usé para hacer este rediseño advierte del fondo crema cercano a `#F4F1EA` como el tic más repetido de interfaz generada, y aterricé justo ahí sin verlo.",
      },
      {
        tipo: "hallazgo",
        texto: "Elegí lo más defendible en cada decisión, y la suma de decisiones defendibles me dejó donde está todo el mundo.",
      },
      {
        tipo: "prosa",
        texto:
          "La corrección no fue quitar el calor, porque entonces el acento frío dejaría de destacar y volvería la planitud del principio. **Fue mover dónde vive.** Los neutros pasan a frío-neutros, el acento sigue siendo tinta, y el contraste de temperatura lo aporta ahora el amarillo del resaltador.",
      },
      {
        tipo: "prosa",
        texto:
          "Y eso convierte el color de la verificación en **la única temperatura de la pantalla**. No es una idea estética que se le ocurrió a alguien: es el mismo criterio con el que el resaltador ya estaba reservado al rastro de verificación, llevado hasta el final. Los semánticos conservan su temperatura a propósito, porque son alertas y leerlos importa más que la coherencia del ambiente.",
      },
      {
        tipo: "prosa",
        texto:
          "La tipografía cambió con la paleta, y de paso corrigió una incoherencia que llevaba meses ahí. El sistema dice que la serifa es la voz del documento y la sans la de la herramienta. Pero «Entiende un documento difícil» **no lo dice el documento, lo dice la aplicación**, e iba en serifa. Los titulares pasaron a la sans; la prosa, lo que simula contenido del documento y este relato entero conservan la serifa.",
      },
      {
        tipo: "prosa",
        texto:
          "Medir antes volvió a pagar: dos tonos de la paleta nueva no llegaban. El atenuado daba ==4,22:1== sobre el fondo y el borde fuerte ==2,81:1==, por debajo del 3:1 que pide un borde. Se oscurecieron lo justo para pasar, y se comprobó sobre lo que de verdad pinta el navegador y no sobre la tabla de hex.",
      },

      { tipo: "encabezado", texto: "Dos voces tipográficas, y lo que significan" },
      {
        tipo: "prosa",
        texto:
          "La decisión que más se nota: **lo que viene del documento va en una serifa; lo que es de la herramienta, en una sans**. Títulos, cuerpo de las secciones, citas y panel de fuente en una; navegación, botones y etiquetas en la otra. Los números siguen en monoespaciada tabular, que es la señal de «esto es un dato».",
      },
      {
        tipo: "prosa",
        texto:
          "No es un gusto: es información. Antes de leer una palabra ya sabes si lo que tienes delante sale del documento o lo pone la aplicación. Este relato que estás leyendo usa el mismo código tipográfico, y por eso se lee como se lee.",
      },
      {
        tipo: "prosa",
        texto:
          "El resaltador quedó **reservado al rastro de verificación**: la cita al pie de una sección, la de una respuesta del chat, la de una diapositiva y el pasaje marcado en el documento comparten componente y color. El aviso pasó de ámbar a óxido para no confundirse con él. Y el borde punteado quedó reservado a «generado», así que el satélite dejó de usarlo y se distingue de otra forma.",
      },

      { tipo: "encabezado", texto: "Lo que NO cambió, que es la mitad del hito" },
      {
        tipo: "prosa",
        texto:
          "Un rediseño visual es la ocasión perfecta para colar cambios de comportamiento, y por eso la lista de lo intocado se escribió explícitamente: la arquitectura de información, los umbrales de columnas del capítulo 10, los modos de detalle, la Generative UI, el contrato, el backend y **la telemetría del capítulo 12**, con los mismos eventos en los mismos puntos.",
      },
      {
        tipo: "cita",
        texto: "En la página principal solo cambió una clase y se pasó un prop de presentación nuevo.",
      },
      {
        tipo: "prosa",
        texto:
          "Que esa frase se pueda escribir es la prueba de que era piel y no arquitectura. Y hacerlo **antes** de las sesiones con usuarios tiene un motivo: que quien participe vea la versión más parecida a la final, y no juzgue una interfaz que iba a cambiar igualmente.",
      },

      { tipo: "encabezado", texto: "Y un cambio que sí era de fondo" },
      {
        tipo: "prosa",
        texto:
          "Durante el hito apareció un problema que no era de color. **Ver y generar estaban mezclados**: diapositivas, presentación y chat eran tres botones iguales, y no se entendía cuál de ellos iba a costar dinero y tiempo.",
      },
      {
        tipo: "prosa",
        texto:
          "Se separaron en dos sitios distintos. *Ver* (documento o diapositivas, resumen o detallado) son formas de mostrar lo que ya existe, y no generan nada. *Generar* (presentación y narración) vive en su propio panel, cada una con una línea que dice qué es, y el botón nombra su estado en vez de quedarse mudo mientras trabaja.",
      },
      {
        tipo: "prosa",
        texto:
          "Es exactamente la misma frontera del capítulo 8: lo que sale del documento por un lado, lo que el sistema inventa por otro. Aquí se volvió geografía de la interfaz.",
      },
    ],
  },
  {
    slug: "telemetria",
    numero: 12,
    acto: "usable",
    titulo: "Medir sin molestar",
    hitos: "Hito 8A · 8A.1",
    conclusion:
      "Revisar el instrumento antes de usarlo encontró un contador roto en 7 de 11 sesiones ya grabadas.",
    bloques: [
      {
        tipo: "prosa",
        texto:
          "Para saber si el sistema sirve hace falta ver a alguien usarlo. Y para que esa observación valga algo hace falta medir qué hace: cuánto tiempo pasa en el modo resumen y cuánto en el detallado, si pregunta con sus palabras o pulsa las sugerencias, y **cuántas veces abre la fuente para comprobar algo**.",
      },
      {
        tipo: "prosa",
        texto:
          "Son ocho tipos de evento, un conjunto cerrado. La parte interesante no es qué se captura sino qué **no**, y que eso no dependa de acordarse.",
      },

      { tipo: "encabezado", texto: "Privacidad que no depende de la buena intención" },
      {
        tipo: "prosa",
        texto:
          "No se captura contenido de documentos, ni el texto de las preguntas, ni nombres de archivo. Solo metadatos: enums, milisegundos, longitudes en caracteres y **ordinales** de sección en vez del identificador, porque ese identificador lo escribe el modelo y podría describir el contenido.",
      },
      {
        tipo: "prosa",
        texto:
          "Pero una promesa que depende de que el frontend se porte bien es frágil, así que hay una **barrera del lado del servidor**: la ingesta rechaza cualquier dato con cadenas largas. Si el cliente se equivocara, el contenido no entra igualmente.",
      },
      {
        tipo: "prosa",
        texto:
          "Y la telemetría **no importa ni referencia** el contrato de datos. Observa; no toca el pipeline ni lo que viaja a los modelos. Es una capa aparte por construcción, no por disciplina.",
      },

      { tipo: "encabezado", texto: "Revisar el instrumento antes de usarlo" },
      {
        tipo: "prosa",
        texto:
          "La telemetría se construyó antes del rediseño del capítulo 11, antes del audio y antes de una ronda de arreglos. Antes de sentar a nadie delante del sistema había que comprobar que siguiera midiendo lo que dice medir, **porque un instrumento roto no se nota durante la sesión, se nota al analizar los datos, cuando ya no hay forma de repetirla.**",
      },
      {
        tipo: "prosa",
        texto:
          "Casi todo estaba bien. Los ocho eventos llegaban, sin contenido; las cuentas cuadraban (25.492 más 94.560 milisegundos dan exactamente la sesión, y el porcentaje de tiempo en detallado sale de esa división) y el identificador del participante estaba donde hacía falta para cruzar con el cuestionario.",
      },
      {
        tipo: "prosa",
        texto:
          "Y había un bug. **El contador de eventos volvía a cero al recargar la pestaña.** El identificador de sesión sobrevive a una recarga, eso es deliberado; el contador no sobrevivía, así que una misma sesión tenía dos eventos con el número 0, dos con el 1, y así.",
      },
      {
        tipo: "figura",
        figura: "orden-seq",
        pie: "El exportador ordenaba por contador. En una sesión con recarga, eso mete los eventos de después entre los de antes.",
      },
      {
        tipo: "prosa",
        texto:
          "La consecuencia medida: con una pregunta real a los 30 segundos y otra a los 70 tras recargar, el exportador decía ==70.000 ms== hasta la primera pregunta y señalaba la pregunta equivocada. Ordenando por tiempo dice ==30.000 ms==.",
      },
      {
        tipo: "prosa",
        texto:
          "**No era hipotético.** Al auditar los archivos ya recogidos: ==7 de 11 sesiones== tenían el contador repetido, una de ellas con ocho arranques dentro de la misma sesión.",
      },
      {
        tipo: "hallazgo",
        texto: "En los datos que ya tenía las dos cifras coincidían, pero por un accidente, no por una propiedad del diseño.",
      },
      {
        tipo: "prosa",
        texto:
          "Esa frase es el capítulo. El orden estable de la herramienta de ordenación conservaba el orden del archivo, así que el resultado salía bien **por casualidad**. Un análisis que depende de una casualidad es un análisis que va a fallar el día que la casualidad no se dé.",
      },

      { tipo: "encabezado", texto: "Arreglado en dos sitios, a propósito" },
      {
        tipo: "prosa",
        texto:
          "En el cliente, el contador pasa a guardarse junto al identificador de sesión y por el mismo motivo, así que ya cruza las recargas. Pero **arreglar el cliente no arregla los archivos ya recogidos**, y esos son datos reales de sesiones que no se pueden repetir.",
      },
      {
        tipo: "prosa",
        texto:
          "Así que el exportador también cambió: ahora ordena por **sello de tiempo** (la verdad de terreno, que no depende de un detalle del cliente) y usa el contador solo para desempatar eventos del mismo milisegundo. Y el arranque y la primera pregunta se eligen por tiempo, no por posición.",
      },
      {
        tipo: "prosa",
        texto:
          "De paso se añadió al resumen el número de recargas, que se deduce de los arranques de más. **No se esconde el ruido: se etiqueta.** Una fila con muchos eventos deja de parecer una sesión más activa de lo que fue y se explica sola.",
      },
      {
        tipo: "prosa",
        texto:
          "Queda decir qué falta. Esta es solo la tubería: el cuestionario de carga de trabajo, la prueba de comprensión y las sesiones con cinco a diez personas **no se han corrido**. El Hito 8 sigue abierto, y el capítulo 14 lo recoge.",
      },
    ],
  },
  {
    slug: "guardar",
    numero: 13,
    acto: "usable",
    titulo: "Guardar y volver",
    hitos: "Login y persistencia",
    conclusion:
      "Quién guardó qué vive fuera del contrato de datos, porque el contrato viaja a los modelos.",
    bloques: [
      {
        tipo: "prosa",
        texto:
          "Hasta aquí el sistema olvidaba todo al cerrar la pestaña. Podías transformar un documento, preguntarle, generar diapositivas y escuchar la narración, y nada de eso sobrevivía a recargar la página.",
      },
      {
        tipo: "prosa",
        texto:
          "La autenticación era la parte fácil. Lo caro era otra cosa: **toda la aplicación daba por hecho que el navegador tenía el archivo en la mano.** Una presentación restaurada no trae archivo, así que cada ruta que lo reenvía necesitaba un segundo camino.",
      },
      {
        tipo: "prosa",
        texto:
          "Parecían ocho endpoints que tocar. Medirlo antes de construir cambió el tamaño del problema.",
      },
      {
        tipo: "figura",
        figura: "un-solo-sitio",
        pie: "Los ocho ya entraban por la misma función. El cambio fue una función, no ocho.",
      },
      {
        tipo: "prosa",
        texto:
          "Y esa única puerta se convirtió en algo mejor que un ahorro de trabajo: es **el punto donde se impone la propiedad**. Lo que no pasa por ahí no puede leer un documento guardado. Un endpoint nuevo que olvidara comprobarla tampoco podría cargar nada.",
      },

      { tipo: "encabezado", texto: "Quién guardó qué no cabe en el contrato" },
      {
        tipo: "prosa",
        texto:
          "La tentación evidente es meter un identificador de usuario en la presentación. Es un campo, y ya está.",
      },
      {
        tipo: "prosa",
        texto:
          "**El contrato viaja a los modelos.** La presentación es el cuerpo de las peticiones de narración y de ilustraciones. Un identificador de usuario dentro de ella acabaría dentro de un prompt por una ruta perfectamente normal, sin que nadie hiciera nada raro.",
      },
      {
        tipo: "hallazgo",
        texto: "La propiedad no es una propiedad del resultado: es del acto de guardarlo.",
      },
      {
        tipo: "prosa",
        texto:
          "Así que vive en la base de datos y nunca en el contrato. El contenido se guarda como un bloque opaco con un número de versión del contrato, que no es ceremonia: **el contrato cambió dos veces en un mes**, al añadir el momento del audio y la región del PDF, y sin ese campo el primer cambio habría dejado ilegible todo lo ya guardado.",
      },

      { tipo: "encabezado", texto: "Decisiones de infraestructura, con su motivo" },
      {
        tipo: "tabla",
        cabeceras: ["Decisión", "Por qué, y qué se descartó"],
        filas: [
          ["SQLite con migraciones numeradas, sin ORM", "un servidor que hay que levantar antes de cada sesión es una pieza más que puede fallar delante del participante; y seis tablas no justifican un ORM que además arrastraría su propio modelo de usuario"],
          ["Sesiones en la base, no un token firmado", "un token guardado se puede revocar: cerrar sesión borra la fila y deja de valer en el acto. Con un token firmado haría falta una lista negra, que es la misma tabla con más pasos"],
          ["Contraseñas con argon2, cookie HttpOnly", "innegociable aunque sea un prototipo: la cookie es lo que impide que un ataque de script se lleve la sesión"],
          ["Documentos direccionados por su contenido", "dos personas que suban el mismo PDF comparten fila y bytes sin coordinación; los bytes van a disco, no a la base"],
          ["La carpeta de datos, fuera de la nube sincronizada", "un servicio de sincronización escribiendo encima de una base SQLite en caliente la corrompe"],
        ],
      },
      {
        tipo: "prosa",
        texto:
          "Y lo que la autenticación **no** lleva, dicho en vez de omitido: sin verificación de correo, sin recuperar contraseña, sin segundo factor y sin límite de intentos. Es autenticación de prototipo y conviene llamarla así.",
      },

      { tipo: "encabezado", texto: "El modo invitado no es una cortesía" },
      {
        tipo: "prosa",
        texto:
          "**Sin cuenta la aplicación funciona exactamente igual que antes.** No es amabilidad: las sesiones de evaluación del capítulo 12 corren sin login, y si entrar se volviera obligatorio, esa evaluación se rompe. Entrar añade *guardar y volver*; no habilita usar el sistema.",
      },
      {
        tipo: "prosa",
        texto:
          "Eso es fácil de romper sin enterarse. Añadir la dependencia de usuario a un endpoint es un cambio de una línea, y no se nota probando a mano **porque quien prueba suele estar dentro**. Por eso hay un test que recorre el árbol de dependencias de cada ruta y fija la lista exacta de las que exigen cuenta: hoy, solo la biblioteca.",
      },
      {
        tipo: "prosa",
        texto:
          "La telemetría tampoco se ató a las cuentas, y el motivo es el consentimiento: promete anonimato por etiqueta de participante. Atarla a una cuenta la volvería identificable y contradiría lo ya prometido a quien firmó. Hay tres pruebas que comprueban que la ingesta no recibe identidad de usuario.",
      },

      { tipo: "encabezado", texto: "Dos fallos que solo aparecieron usándolo" },
      {
        tipo: "prosa",
        texto:
          "Pulsar «Guardar» dos veces creaba **dos presentaciones**. Deshabilitar el botón no habría servido, y el motivo es interesante: las ilustraciones del capítulo 8 llegan *después* de guardar, así que volver a pulsar es legítimo. Ahora, si lo que hay en pantalla ya está guardado, se completa en vez de duplicar.",
      },
      {
        tipo: "prosa",
        texto:
          "El segundo es el mejor ejemplo de todo este relato. Una presentación con ilustraciones **no se podía guardar**: devolvía un error. El contenido viajaba como un campo de formulario, y el framework topa esos campos en un megabyte; las ilustraciones son imágenes incrustadas, de varios megabytes. Ahora viaja como parte de archivo, que no tiene ese tope.",
      },
      {
        tipo: "hallazgo",
        texto: "Llevaba roto desde que la biblioteca existe, y ningún test podía haberlo encontrado: todos mandaban cargas de unos cientos de bytes.",
      },
      {
        tipo: "prosa",
        texto:
          "La suite estaba verde todo el tiempo. Lo encontró usar la aplicación con un documento real, que es lo que ninguna prueba automática sustituye del todo, y la razón por la que en este proyecto cada hito termina delante del sistema corriendo.",
      },
    ],
  },
  {
    slug: "lo-que-no-se-hizo",
    numero: 14,
    acto: "cierre",
    titulo: "Lo que no se hizo, y por qué",
    hitos: "Todo el proyecto",
    conclusion:
      "La lista completa de limitaciones declaradas. Es el capítulo que sostiene a los trece anteriores.",
    bloques: [
      {
        tipo: "prosa",
        texto:
          "Trece capítulos diciendo que un sistema debe declarar lo que no puede probar se quedan en retórica si no hay un sitio donde esté la lista. Este es ese sitio, y es el capítulo que sostiene a los otros trece.",
      },
      {
        tipo: "prosa",
        texto:
          "Nada de lo que viene es una sorpresa: todo estaba dicho en su capítulo. Lo que hace este es ponerlo junto, donde se pueda leer de una vez y sin buscarlo.",
      },

      { tipo: "encabezado", texto: "Lo que la atribución no alcanza" },
      {
        tipo: "prosa",
        texto:
          "Solo con un **texto** la palabra «comprobada» es literal. Con un PDF con capa de texto te queda un recuadro sobre la frase; con una grabación, el segundo exacto; con una **imagen**, la cita y ningún sitio al que ir.",
      },
      {
        tipo: "prosa",
        texto:
          "Un **PDF escaneado** te deja en la página y ahí se queda: señalar la frase pediría reconocer el texto dentro de la imagen, y eso no se hace. Y hay un caso raro y real: en una página rotada 90 grados, el extractor devuelve los renglones en orden inverso al visual, así que una cita de varias líneas **degrada a fidelidad de página** en vez de recuadrarse. Sin resolver.",
      },
      {
        tipo: "prosa",
        texto:
          "En audio, la fidelidad es al **momento**, no a la palabra: no hay verificación contra la señal. Y sigue en pie el pendiente de fondo: verificar de verdad un contenido binario contra su fuente. Localizar ya se hace; **localizar no es verificar**.",
      },

      { tipo: "encabezado", texto: "Lo que se midió poco, o no se midió" },
      {
        tipo: "tabla",
        cabeceras: ["Qué", "En qué estado está"],
        filas: [
          ["Las sesiones con usuarios", "sin correr: el cuestionario y la prueba de comprensión están diseñados, la tubería de datos funciona, las personas faltan"],
          ["El experimento de RAG", "tres documentos, treinta preguntas, una sola repetición: sin medida de varianza, y el juez es de la misma familia que el generador"],
          ["La batería de imágenes", "seis casos por tanda: orientativo, no establecido"],
          ["La evaluación del audio", "ocho clips y una repetición: son señales, no tasas"],
          ["El fallback de estructuración", "verificado solo a nivel de cableado: nunca se forzó un fallo del primario de punta a punta"],
          ["La verificación semántica de gráficos", "implementada y probada con modelo simulado; no confirmada con el real"],
        ],
      },
      {
        tipo: "prosa",
        texto:
          "La fila más importante es la primera. Todo lo que este relato afirma sobre diseño es **criterio**, no evidencia de uso. Que la aplicación sea más fácil de entender, o que la gente de verdad abra las fuentes para comprobar, no está demostrado por nada de lo aquí escrito.",
      },

      { tipo: "encabezado", texto: "Capacidades que existen y no se ejercitaron" },
      {
        tipo: "prosa",
        texto:
          "No es lo mismo que fallaron. En la anotación de audio hay dos campos (qué cifras quedan en riesgo y si algo resulta ininteligible) que **nunca se activaron**: tras dos grabaciones no se consiguió un caso donde el ruido volviera una cifra ininteligible para los modelos, y forzarlo habría exigido un clip que ya no representa el caso de uso.",
      },
      {
        tipo: "prosa",
        texto:
          "Y el contrapeso del audio, que es un fallo real y está señalado sin cuantificar: **bajo ruido, una sola voz puede reportarse como dos**, y con confianza alta. Es la primera candidata a atender si esa pieza se amplía.",
      },
      {
        tipo: "prosa",
        texto:
          "Lo mismo con el bucle completo de chat sobre una grabación en la interfaz: los tres endpoints se verificaron contra los modelos reales y el reenvío está cubierto por pruebas, pero **el recorrido entero no se miró a ojo**.",
      },

      { tipo: "encabezado", texto: "Topes y alcances declarados" },
      {
        tipo: "prosa",
        texto:
          "El audio tiene un tope de **quince minutos**, y no es un número redondo: lo fija el techo de salida del modelo que escucha, medido en unos 18,5 minutos. Pasar de ahí exige trocear el audio en ventanas y unir anotaciones, con sus propias preguntas sin respuesta todavía, la continuidad de los hablantes, los tiempos globales.",
      },
      {
        tipo: "prosa",
        texto:
          "La autenticación es de prototipo: sin verificación de correo, sin recuperar contraseña, sin segundo factor, sin límite de intentos. La biblioteca **no se pagina**. Hay un tipo de gráfico, la dispersión, que no se puede dibujar porque los datos se modelan como categorías y series, no como pares de coordenadas. Y la composición de varios tipos dentro de una sección es especificación escrita, no código.",
      },

      { tipo: "encabezado", texto: "Qué sostiene esto" },
      {
        tipo: "prosa",
        texto:
          "Mirado de golpe, el patrón que más se repite en estos catorce capítulos no es una decisión técnica: es **medir antes de construir, y volver a medir contra el sistema corriendo**.",
      },
      {
        tipo: "prosa",
        texto:
          "Eso quitó tres piezas de arquitectura en el capítulo 6, cambió el modo de salida del agente en el 9, desmontó una hipótesis razonable sobre los prompts en el 8, encontró un instrumento roto en el 12, y convirtió ocho endpoints en una función en el 13. Y las cuatro cosas que ninguna suite verde encontró (el buffer del proxy, el contador que se reiniciaba, el tope de un megabyte, el cálculo del punto de equilibrio) aparecieron todas usando el sistema o releyendo los datos crudos.",
      },
      {
        tipo: "hallazgo",
        texto: "Una suite en verde dice que lo que probaste funciona. No dice nada de lo que no se te ocurrió probar.",
      },
      {
        tipo: "prosa",
        texto:
          "Y el capítulo 11 añade el límite de ese método, que es el más incómodo de todos. **Medir solo responde la pregunta que hiciste.** El primer rediseño midió por qué la interfaz se sentía plana, lo arregló, y la dejó pareciéndose a otro producto, porque «¿a qué se parece esto?» no era una de las preguntas. Lo encontró alguien mirándola, meses después.",
      },
      {
        tipo: "prosa",
        texto:
          "Por eso esta lista existe, y por eso cada capítulo termina diciendo lo que no alcanzó. Un sistema que presume de trazabilidad y esconde sus límites está haciendo exactamente lo que dice combatir.",
      },
    ],
  },
];

export function capituloPorSlug(slug: string): Capitulo | undefined {
  return CAPITULOS.find((c) => c.slug === slug);
}
