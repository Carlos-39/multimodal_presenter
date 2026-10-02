# Guion de clips para la mini-evaluación de audio (hallazgo A1)

> Guion de grabación para los 8 clips de la mini-evaluación de la entrada de audio.
> Lo que se compara es si la **fase de percepción** (`AudioEvidence` → Sonnet) produce
> presentaciones mejores que la **línea base** (transcripción plana → Sonnet) en las tres cosas
> que una transcripción descarta: qué se destaca, qué cifras quedan matizadas, y a quién se
> atribuye cada idea.
>
> **Por qué los grabas tú y no se sintetizan:** con voz sintética la prosodia (énfasis, duda,
> titubeo) la produce un TTS siguiendo instrucciones, no una persona hablando. Medir si un
> modelo capta énfasis humano usando énfasis sintético mediría otra cosa. Esta decisión es
> parte de la validez de la evaluación, no un detalle de producción.

---

## Cómo grabar

- **Formato:** MP3, WAV o **M4A** (el `.m4a`/`.mp4` que graba la Grabadora de Windows y el
  celular por defecto — no hace falta cambiar nada ni convertir). Mono está bien.
  La única salvedad: si este backend llegara a correr por la ruta de contingencia (OpenRouter
  en vez de Google), el M4A no viaja y el sistema te lo dirá pidiéndote MP3. Con la clave de
  Google puesta, no aplica.
- **Duración:** 20–45 s por clip. Cortos a propósito: el sistema acota el audio a 15 min y lo
  que se mide aquí son rasgos puntuales, no resistencia a audio largo.
- **Idioma:** español.
- **Dónde:** guárdalos en `backend/tests/fixtures/local/audio/` con el nombre de archivo exacto
  de cada ficha. Esa carpeta está gitignoreada (igual que los PDFs reales del 5f): los clips con
  tu voz **no se suben al repositorio**.
- **Notación del guion:**
  - `MAYÚSCULAS` = dilo con énfasis audible real (más volumen o tono marcado, no solo más
    rápido).
  - `…` = pausa de verdad (1–2 s de silencio).
  - `[nota]` = indicación de cómo decirlo, no se lee en voz alta.
- **No te lo aprendas de memoria ni lo actúes de más.** Un énfasis exagerado haría la prueba
  trivialmente fácil y el resultado no diría nada. Lee como leerías un informe en una reunión.
- Si te trabas, **no vuelvas a grabar desde cero**: un titubeo natural es exactamente lo que
  esta evaluación quiere oír. Solo re-graba si se oye mal de verdad.

---

## Los 8 clips

### c1 — Énfasis sobre una cifra
**Archivo:** `c1_enfasis_cifra.wav` · 1 hablante · sin ruido

> El informe trimestral trae tres datos. Las ventas llegaron a mil doscientos millones, los
> costos operativos bajaron a trescientos diez millones, y el margen neto subió al CUARENTA Y
> DOS POR CIENTO. … Eso último es lo que cambia la conversación con la junta.

**Qué se mide:** que la cifra remarcada quede en una sección núcleo o en el título, no diluida
entre las otras dos cifras. La transcripción plana ve tres cifras igual de importantes.

---

### c2 — Énfasis sobre un juicio, no sobre un número
**Archivo:** `c2_enfasis_juicio.wav` · 1 hablante · sin ruido

> Mucha gente mira el crecimiento de usuarios, que fue del dieciocho por ciento. Pero lo
> importante NO ES EL CRECIMIENTO. … Es la RETENCIÓN. Si no retienes, el crecimiento solo te
> hace gastar más rápido.

**Qué se mide:** que la idea central de la presentación sea la retención y no el 18 % de
crecimiento. Es el caso donde la prosodia contradice lo que el léxico sugeriría por frecuencia.

---

### c3 — Duda explícita sobre una cifra
**Archivo:** `c3_duda_cifra.wav` · 1 hablante · sin ruido

> La inversión en infraestructura este año fue de… eh… no sé, unos ochocientos mil, creo. …
> Habría que confirmarlo con finanzas. Lo que sí está cerrado es el presupuesto de personal:
> un millón doscientos mil exactos.

**Qué se mide:** que los ochocientos mil aparezcan **matizados** ("alrededor de", "según el
hablante, aproximadamente", "sin confirmar") y el millón doscientos mil **no**. Una
transcripción plana deja las dos cifras con la misma autoridad.

---

### c4 — Dos hablantes con cifras distintas
**Archivo:** `c4_dos_hablantes.wav` · 2 hablantes · sin ruido

> **Voz A:** Según el cierre de agosto, la rotación de personal fue del doce por ciento.
> **Voz B:** A mí me salió distinto. Yo tengo quince por ciento, pero yo estoy contando también
> los contratos temporales.
> **Voz A:** Ah, entonces no estamos midiendo lo mismo.

[Necesitas una segunda voz. Si no hay nadie a mano, grábalo en dos tomas con voces claramente
distintas —una más grave, otra más aguda, o distinto ritmo— y pégalas. Anótalo en el manifiesto.]

**Qué se mide:** que la presentación **atribuya** cada cifra a quien la dijo y no promedie,
elija una o las funda en una sola afirmación. Es el fallo más grave posible de una
transcripción plana sin diarización.

---

### c5 — Dos hablantes, uno enfatiza
**Archivo:** `c5_dos_hablantes_enfasis.wav` · 2 hablantes · sin ruido

> **Voz A:** El piloto salió bien. Tiempos de respuesta por debajo de dos segundos y cero
> incidentes de seguridad.
> **Voz B:** Sí, pero el piloto fueron OCHO USUARIOS. … OCHO. No podemos presentar eso como
> validación.

**Qué se mide:** atribución **y** énfasis juntos. Lo correcto es que la objeción de la voz B
quede visible y atribuida, no fundida en un resumen optimista del piloto.

---

### c6 — Ruido de fondo sobre una cifra
**Archivo:** `c6_ruido.wav` · 1 hablante · **con ruido**

> El estudio cubrió… [aquí la cifra queda tapada: di "cuatrocientos" mientras el ruido está
> fuerte] …municipios, en siete departamentos. El trabajo de campo tomó cuatro meses.

[Pon ruido real de fondo: tráfico por la ventana, un ventilador, una cafetería, música. Que
tape de verdad la primera cifra —que tú mismo dudes al re-escucharla—, pero que el resto se
entienda.]

**Qué se mide:** que el sistema **declare** que esa cifra no se oyó bien, en vez de escribir un
número con plena autoridad. La transcripción plana devolverá algún número (o ninguno) sin avisar.

---

### c7 — Control: informativo y plano
**Archivo:** `c7_control_plano.wav` · 1 hablante · sin ruido

> El proyecto tiene tres fases. La primera es el diagnóstico, de enero a marzo. La segunda es
> el diseño, de abril a junio. La tercera es la implementación, de julio a diciembre. El
> presupuesto total es de quinientos millones.

[Lee esto **plano**, sin énfasis, sin pausas dramáticas, sin dudar. Como si leyeras una lista.]

**Qué se mide:** que las dos condiciones den **prácticamente lo mismo**. Este clip existe para
poder detectar lo contrario de lo que esperamos: si la percepción inventara énfasis o matices
aquí donde no hay ninguno, eso sería anotación alucinada y el clip lo delataría. Un empate aquí
es el resultado correcto.

---

### c8 — Evento no verbal que cambia la lectura
**Archivo:** `c8_no_verbal.wav` · 1 hablante · sin ruido

> Y el cronograma original decía que esto estaría listo en dos semanas. … [ríete de verdad,
> brevemente] … Bueno. Vamos por el mes cuatro.

**Qué se mide:** si la risa se registra como evento no verbal y si cambia algo en la
presentación. **Expectativa honesta: probablemente no cambie nada.** La literatura
(AudioBench, LISTEN) dice que los modelos de audio captan la paralingüística de forma parcial
y muy dependiente del contenido léxico — y aquí el léxico ya delata el retraso. Se incluye
porque un caso donde esperamos que falle hace la evaluación informativa en ambas direcciones.

---

## Cuando termines

1. Deja los 8 archivos en `backend/tests/fixtures/local/audio/`.
2. Revisa `backend/scripts/audio_clips_manifest.json`: cada clip ya trae anotado qué se diseñó
   (qué frase enfatizaste, qué cifra quedó dudosa, cuántos hablantes). **Si al grabar cambiaste
   algo** —otra cifra, otra frase enfatizada, no conseguiste segunda voz— corrígelo ahí, porque
   el arnés mide contra eso. El manifiesto es la verdad de referencia de esta evaluación, igual
   que el `dataset.json` lo era en el Hito 7; y la auditoría de ese dataset dejó claro lo que
   cuesta no revisarlo a tiempo.
3. Avísame y corro la mini-evaluación.
