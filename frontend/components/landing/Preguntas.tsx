import { CaretDown } from "@phosphor-icons/react/dist/ssr";

/**
 * Preguntas frecuentes.
 *
 * Aquí es donde van los límites del sistema, y no en una sección propia: dicho al pasar en medio
 * de la portada frena a quien todavía no sabe qué es esto; dicho aquí lo contesta quien ya se lo
 * está preguntando. No se suaviza ninguno — lo que cambia es dónde se cuenta.
 *
 * Son `<details>` nativos: funcionan con el teclado y con un lector de pantalla sin que haya que
 * construir nada, y abren aunque el JavaScript no llegue a cargar.
 */
const PREGUNTAS: { p: string; r: string }[] = [
  {
    p: "¿Se inventa cosas?",
    r: "Cada sección trae la frase del documento de la que salió, y se comprueba que exista de verdad. Cuando una afirmación no se puede anclar a una cita exacta, la aplicación lo dice y retira el enlace a la fuente en vez de enseñar una cita que no está. Es la diferencia entre decir «no pude verificar esto» y fingir que sí.",
  },
  {
    p: "¿Hace falta crear una cuenta?",
    r: "No. Sin cuenta funciona todo: transformar, preguntar, generar diapositivas y escuchar la narración. Entrar sirve para una cosa, guardar lo que hiciste y volver a ello otro día, con su documento y su conversación.",
  },
  {
    p: "¿Qué formatos acepta?",
    r: "Texto pegado, PDF, imágenes (PNG, JPEG, WEBP) y grabaciones de audio en los formatos habituales, incluido el del grabador del móvil. El audio tiene un tope de quince minutos, que no es un número redondo: es el techo real de la anotación que produce el modelo que escucha.",
  },
  {
    p: "¿Qué pasa con un PDF escaneado?",
    r: "Te lleva a la página donde está la cita, y ahí se queda. Señalar la frase exacta haría falta reconocer el texto dentro de la imagen, y eso no se hace. Es menos de lo que ofrece un PDF con texto, y se dice en vez de disimularlo.",
  },
  {
    p: "¿Y si subo una foto?",
    r: "La cita vuelve como texto, pero no hay ningún sitio al que llevarte dentro de la foto: no se señala la zona ni se dice la página, porque una imagen no tiene páginas. Es la entrada con la atribución más débil de las cuatro, por el mismo motivo que el PDF escaneado. Con un texto la cita se compara carácter por carácter; con un PDF con texto te deja un recuadro sobre la frase; con una grabación te deja en el segundo exacto; con una imagen solo tienes la cita.",
  },
  {
    p: "¿Las imágenes que genera salen del documento?",
    r: "No, y por eso llevan siempre una etiqueta encima que lo dice, de forma permanente. Son una ayuda para entender, nunca una prueba. La aplicación solo las genera cuando el documento no trae material visual propio y el contenido se beneficia de verlo.",
  },
  {
    p: "¿Qué pasa con mis documentos?",
    r: "Sin cuenta no se guarda nada: todo vive en tu navegador mientras dura la visita. Con cuenta se guarda solo lo que pulsas guardar, y únicamente tú puedes abrirlo.",
  },
];

export function Preguntas() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-3xl px-5 py-20">
        <h2 className="font-sans text-[2rem] font-medium leading-[1.08] tracking-[-0.025em] text-foreground sm:text-[2.6rem]">
          Preguntas frecuentes
        </h2>

        <div className="preguntas mt-9">
          {PREGUNTAS.map(({ p, r }) => (
            <details key={p} className="group border-b border-border first:border-t">
              <summary className="flex cursor-pointer list-none items-start gap-4 py-4 text-left [&::-webkit-details-marker]:hidden">
                {/* El número no es adorno: estas preguntas se citan («la tercera dice que…») y
                    numerarlas da con qué citarlas. En acento, que es lo que las separa del resto
                    de la página sin inventar un color nuevo. */}
                <span
                  aria-hidden
                  className="numero mt-[0.3rem] shrink-0 font-mono text-[0.75rem] tabular-nums text-accent transition-opacity"
                />
                <span className="flex-1 font-sans text-[1.125rem] font-medium leading-snug tracking-[-0.012em] text-foreground transition-colors group-open:text-accent">
                  {p}
                </span>
                <CaretDown
                  size={15}
                  aria-hidden
                  className="mt-[0.35rem] shrink-0 text-muted transition-transform group-open:rotate-180 group-open:text-accent motion-reduce:transition-none"
                />
              </summary>
              {/* La respuesta sube desde detrás del renglón en vez de aparecer de golpe. Es el
                  único gesto que me traje del menú escalonado, y es CSS: así los `details` siguen
                  siendo nativos —teclado, lector de pantalla, y abren aunque el JavaScript no
                  cargue—, que es por lo que se eligieron. */}
              <div className="respuesta overflow-hidden">
                <p className="ml-9 max-w-[64ch] pb-5 text-[0.9375rem] leading-[1.65] text-foreground-secondary">
                  {r}
                </p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
