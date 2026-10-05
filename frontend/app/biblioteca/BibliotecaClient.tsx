"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  FileAudio,
  FilePdf,
  FileText,
  Image as ImageIcon,
  MagnifyingGlass,
  Plus,
} from "@phosphor-icons/react";
import type { ResumenPresentacion, Usuario } from "@/lib/account";
import { borrarPresentacion, misPresentaciones, quienSoy } from "@/lib/account";
import type { SourceKind } from "@/lib/types";
import { fechaRelativa, TRAMOS, tramoDe, type Tramo } from "@/lib/fechas";
import { AuthForm } from "@/components/shell/AuthForm";
import { BotonMecha, type MechaHandle } from "@/components/shell/BotonMecha";
import { Cubos } from "@/components/shell/Cubos";
import { FilaDeslizable } from "@/components/shell/FilaDeslizable";
import { ThemeToggle } from "@/components/shell/ThemeToggle";

/**
 * La biblioteca, como sitio propio.
 *
 * **Vivía dentro del cajón de cuenta**, y una biblioteca que solo aparece si abres tu perfil es
 * una biblioteca que no existe: había gente usando la aplicación sin saber que lo guardado estaba
 * en alguna parte.
 *
 * Es una ruta y no una vista dentro del armazón porque el núcleo fijo existe para servir a UN
 * documento: aquí no hay nivel de detalle que ajustar, ni fuente que abrir, ni chat, ni nada que
 * generar. Enseñar el armazón con casi todo apagado es peor que una página limpia — el mismo
 * criterio por el que el «cómo se construyó» también es una ruta.
 *
 * **Sin cuenta no se echa a nadie:** se ofrece entrar, aquí mismo, con el formulario de siempre.
 * Un muro de 401 sería el único sitio de la aplicación que trata a un invitado como un error.
 */
/** A partir de cuantas presentaciones vale la pena un buscador. */
const UMBRAL_BUSCADOR = 6;

const ICONOS: Record<SourceKind, typeof FileText> = {
  text: FileText,
  pdf: FilePdf,
  image: ImageIcon,
  audio: FileAudio,
};

export function BibliotecaClient() {
  const [usuario, setUsuario] = useState<Usuario | null | undefined>(undefined);
  const [lista, setLista] = useState<ResumenPresentacion[] | null>(null);
  const [filtro, setFiltro] = useState("");

  // Se filtra por titulo y nada mas: buscar dentro del contenido seria otra cosa -y pediria al
  // servidor- y prometerlo sin hacerlo es peor que no ofrecerlo.
  const busqueda = filtro.trim().toLocaleLowerCase("es");
  const filtradas = (lista ?? []).filter(
    (p) => !busqueda || p.titulo.toLocaleLowerCase("es").includes(busqueda),
  );

  // `vivo` corta el camino si el componente se desmonta a mitad de las dos peticiones: fijar
  // estado sobre algo ya desmontado es un aviso en desarrollo y una fuga en producción.
  const cargar = useCallback(async (vivo: () => boolean) => {
    const quien = await quienSoy();
    if (!vivo()) return;
    setUsuario(quien);
    if (!quien) return;
    const guardadas = await misPresentaciones();
    if (vivo()) setLista(guardadas);
  }, []);

  useEffect(() => {
    let montado = true;
    // En un microtask y no en el cuerpo del efecto: la regla de pureza del proyecto prohíbe
    // `setState` síncrono ahí, y no sabe ver que `cargar` espera a la red antes de tocar nada.
    // Es el mismo patrón de `useEnPantalla`.
    queueMicrotask(() => void cargar(() => montado));
    return () => {
      montado = false;
    };
  }, [cargar]);

  return (
    <div className="foco min-h-[100dvh]">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-5">
          <Link href="/" className="text-sm font-medium tracking-tight text-foreground">
            Multimodal Presenter
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {usuario ? (
              <Link
                href="/"
                className="flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-1.5 text-xs font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
              >
                <Plus size={13} weight="bold" aria-hidden />
                Nueva
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-12">
        {usuario === undefined ? (
          <Cargando />
        ) : usuario === null ? (
          <SinCuenta onDentro={() => void cargar(() => true)} />
        ) : (
          <>
            <h1 className="font-sans text-[1.75rem] font-medium leading-tight tracking-[-0.022em] text-foreground sm:text-[2.25rem]">
              Tu biblioteca
            </h1>
            <p className="mt-2 text-sm text-muted">
              {lista === null
                ? "Buscando lo que guardaste…"
                : lista.length === 0
                  ? "Todavía no hay nada aquí."
                  : `${lista.length} ${lista.length === 1 ? "presentación guardada" : "presentaciones guardadas"}`}
            </p>

            {/* El buscador solo cuando hay bastante que buscar. Con tres presentaciones un campo
                de busqueda es un trasto que ocupa sitio y no resuelve nada. */}
            {lista && lista.length >= UMBRAL_BUSCADOR ? (
              <div className="relative mt-6 max-w-sm">
                <MagnifyingGlass
                  size={14}
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="search"
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  placeholder="Buscar por titulo"
                  aria-label="Buscar en tu biblioteca"
                  className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm text-foreground transition-colors placeholder:text-muted hover:border-border-strong focus:border-accent focus:outline-none"
                />
              </div>
            ) : null}

            <div className="mt-8">
              {lista === null ? (
                <Cargando />
              ) : lista.length === 0 ? (
                <Vacia />
              ) : filtradas.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted">
                  Nada con esa palabra. Prueba con otra del titulo.
                </p>
              ) : (
                /* Por montones y no en una cuadricula seguida: con quince presentaciones, saber
                   que algo es de hoy o de hace un mes es la mitad de encontrarlo. Los montones
                   vacios no se dibujan. */
                <div className="flex flex-col gap-10">
                  {(Object.keys(TRAMOS) as Tramo[]).map((t) => {
                    const grupo = filtradas.filter((x) => tramoDe(x.creada_en) === t);
                    if (!grupo.length) return null;
                    return (
                      <section key={t}>
                        <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-muted">
                          {TRAMOS[t]}
                        </h2>
                        <ul className="mt-4 grid gap-4 md:grid-cols-2">
                          {grupo.map((x) => (
                            <Tarjeta
                              key={x.id}
                              presentacion={x}
                              onBorrada={(id) =>
                                setLista((l) => (l ?? []).filter((y) => y.id !== id))
                              }
                            />
                          ))}
                        </ul>
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Cargando() {
  return (
    <ul className="grid gap-4 md:grid-cols-2" role="status" aria-label="Cargando">
      {[0, 1, 2].map((i) => (
        <li key={i} className="skeleton h-40 rounded-xl" />
      ))}
    </ul>
  );
}

/**
 * El estado vacío dice qué hacer, no solo que no hay nada. Es la pantalla que más gente va a ver
 * la primera vez que entra con cuenta, así que el botón es la pieza principal, no una nota al pie.
 */
function Vacia() {
  return (
    /*
     * El signo de mas ES el boton, y no un dibujo con un boton debajo.
     *
     * Antes habia un recuadro punteado con un parrafo y un enlace: tres cosas para decir una. Aqui
     * lo primero que se ve es la accion, en grande, y el texto explica debajo. En una pantalla que
     * esta vacia a proposito, lo unico que debe pesar es por donde se sale de ella.
     *
     * El trazo se dibuja al entrar -el mismo gesto que las figuras del «como se construyo»- y al
     * pasar por encima el aspa gira un cuarto de vuelta hasta la cruz. Con «reducir movimiento» no
     * se dibuja ni gira: sale puesto.
     */
    <div className="relative isolate flex flex-col items-center px-6 py-16 text-center">
      {/* Los cubos, en la esquina y detrás de todo. Se difuminan hacia el centro para que no se
          acerquen al texto ni al botón: la retícula acompaña, no compite. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-6 -right-6 -z-10 w-[clamp(14rem,34vw,22rem)] opacity-[0.55] [-webkit-mask-image:radial-gradient(circle_at_85%_85%,black_20%,transparent_75%)] [mask-image:radial-gradient(circle_at_85%_85%,black_20%,transparent_75%)]"
      >
        <Cubos />
      </div>

      <Link
        href="/"
        aria-label="Transformar mi primer documento"
        className="mas group flex h-28 w-28 items-center justify-center rounded-2xl border border-dashed border-border-strong text-accent transition-colors hover:border-accent hover:bg-accent-subtle/40"
      >
        <svg viewBox="0 0 48 48" className="h-12 w-12" aria-hidden>
          <line x1="24" y1="10" x2="24" y2="38" pathLength={1} className="mas-trazo" />
          <line x1="10" y1="24" x2="38" y2="24" pathLength={1} className="mas-trazo" style={{ animationDelay: "160ms" }} />
        </svg>
      </Link>

      <p className="mt-7 max-w-[34ch] font-serif text-[1.0625rem] leading-[1.6] text-foreground-secondary">
        Aquí van a aparecer los documentos que transformes y guardes, con su conversación y lo que
        hayas generado.
      </p>
      <Link
        href="/"
        className="mt-5 inline-flex items-center gap-1.5 text-sm text-accent transition-colors hover:text-accent-hover"
      >
        Transformar mi primer documento
        <ArrowRight size={14} aria-hidden />
      </Link>
    </div>
  );
}

function SinCuenta({ onDentro }: { onDentro: () => void }) {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="font-sans text-[1.75rem] font-medium leading-tight tracking-[-0.022em] text-foreground">
        Tu biblioteca
      </h1>
      <p className="mt-2 max-w-[42ch] font-serif text-[1.0625rem] leading-[1.6] text-foreground-secondary">
        Guardar es lo único que pide una cuenta. Sin ella la aplicación funciona entera.
      </p>
      <div className="mt-7 rounded-xl border border-border bg-surface p-5">
        <AuthForm onUsuario={() => onDentro()} />
      </div>
      <Link
        href="/"
        className="mt-5 inline-flex items-center gap-1.5 text-sm text-foreground-secondary transition-colors hover:text-foreground"
      >
        Seguir sin cuenta
        <ArrowRight size={14} aria-hidden />
      </Link>
    </div>
  );
}

/**
 * Toda la tarjeta abre. Lleva a `/?abrir=<id>`, no a una ruta propia: la presentación se restaura
 * **dentro del área de trabajo**, que es donde vive todo lo que se puede hacer con ella.
 *
 * **Eliminar vive en la tarjeta y no en un diálogo.** La ventana para arrepentirse ocurre aquí
 * mismo, sobre la cosa que va a desaparecer, y mientras tanto la tarjeta se atenúa y deja de
 * abrirse: ya está medio ida. Un «¿seguro?» pregunta antes de que pase nada y se contesta que sí
 * sin leerlo; esto deja ver la consecuencia y da tiempo a cambiar de idea.
 *
 * **Con el dedo también se arrastra**, y acaba en esa misma ventana: el gesto enciende la mecha,
 * no borra. El botón sigue estando para todo lo demás.
 */
function Tarjeta({
  presentacion,
  onBorrada,
}: {
  presentacion: ResumenPresentacion;
  onBorrada: (id: string) => void;
}) {
  const { id, titulo, source_kind, nombre_archivo, creada_en } = presentacion;
  const Icono = ICONOS[source_kind] ?? FileText;
  const [yendose, setYendose] = useState(false);
  const mecha = useRef<MechaHandle>(null);

  // La posición del foco se escribe en el DOM, no en estado: con doce tarjetas en pantalla, un
  // `setState` por movimiento del ratón volvería a renderizar la biblioteca entera.
  const foco = (e: React.PointerEvent<HTMLElement>) => {
    const n = e.currentTarget;
    const r = n.getBoundingClientRect();
    n.style.setProperty("--luz-x", `${e.clientX - r.left}px`);
    n.style.setProperty("--luz-y", `${e.clientY - r.top}px`);
    n.style.setProperty("--luz-o", "1");
  };
  const apagar = (e: React.PointerEvent<HTMLElement>) => {
    e.currentTarget.style.setProperty("--luz-o", "0");
  };

  return (
    <li className="h-full">
      <FilaDeslizable onDeslizar={() => mecha.current?.armar()}>
      <div className="absolute right-3 top-3 z-10">
        <BotonMecha
          ref={mecha}
          compacto
          onArmado={setYendose}
          onConfirmar={() => {
            // Solo aquí se borra de verdad. Si da error, la tarjeta vuelve: perder algo en
            // silencio porque falló la red sería lo peor que puede hacer esta pantalla.
            void borrarPresentacion(id).then(
              () => onBorrada(id),
              () => setYendose(false),
            );
          }}
        />
      </div>

      {/*
        * Lo que se enciende al pasar por encima es el BORDE, no el relleno: un relleno tapa, un
        * borde señala. Y en acento, que cambia con el tema — el blanco del botón de la portada
        * aquí daba un manchón en oscuro y nada en claro.
        *
        * Alto fijo (`h-52`): las tarjetas tienen que medir lo mismo aunque un título ocupe dos
        * líneas y otro una. Una rejilla con tarjetas desiguales se lee como un descuido.
        */}
      <Link
        href={`/?abrir=${encodeURIComponent(id)}`}
        aria-hidden={yendose}
        tabIndex={yendose ? -1 : undefined}
        onPointerMove={foco}
        onPointerLeave={apagar}
        className={`borde-luz group flex h-52 flex-col rounded-xl border bg-surface p-5 transition-all ${
          yendose
            ? // Mientras la mecha corre, la tarjeta se marca con el color del aviso en vez de
              // limitarse a apagarse: atenuada y nada más parecía que algo se había roto, no que
              // esto se va. El borde y el botón pasan a ser la misma cosa.
              "pointer-events-none border-warning/60 opacity-60"
            : "border-border hover:border-accent"
        }`}
      >
        <div className="flex items-start gap-2.5">
          <Icono size={16} aria-hidden className="mt-1 shrink-0 text-muted" />
          <h2
            className={`line-clamp-2 min-w-0 flex-1 font-serif text-[1.0625rem] leading-snug text-foreground ${
              // El hueco crece con el botón: armado pasa de icono a «Deshacer 5» y, con el hueco
              // de reposo, se montaba encima del título.
              yendose ? "pr-24" : "pr-7"
            }`}
          >
            {titulo}
          </h2>
        </div>

        {/* El asomo de lo que hay dentro. Tres líneas y puntos suspensivos: con seis guardadas del
            mismo documento, el título no basta para saber cuál es cuál. */}
        {presentacion.resumen ? (
          <p className="mt-3 line-clamp-3 text-[0.8125rem] leading-[1.6] text-foreground-secondary">
            {presentacion.resumen}
          </p>
        ) : null}
        <div className="mt-auto pt-4 text-xs text-muted">
          {nombre_archivo ? (
            <p className="truncate" title={nombre_archivo}>
              {nombre_archivo}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="tabular">{fechaRelativa(creada_en)}</span>
            <Anclaje secciones={presentacion.secciones} verificadas={presentacion.verificadas} />
          </div>
        </div>
      </Link>
      </FilaDeslizable>
    </li>
  );
}


/**
 * Cuantas secciones quedaron ancladas al documento.
 *
 * **Es el unico dato que distingue a este sistema, y la biblioteca no lo ensenaba.** Estaba
 * guardado desde el principio dentro del payload, pero el listado no puede leer el payload -un
 * deck con ilustraciones son megas por fila-, asi que ahora los dos numeros se guardan aparte al
 * guardar y viajan en el resumen.
 *
 * Verde cuando estan todas; ambar cuando falta alguna, que es el mismo color con el que la
 * aplicacion dice que no pudo verificar algo. Y si el dato no esta -presentaciones guardadas antes
 * de que esto existiera- no se ensena nada: inventarlo seria peor que callarlo.
 */
function Anclaje({
  secciones,
  verificadas,
}: {
  secciones: number | null;
  verificadas: number | null;
}) {
  if (secciones === null || verificadas === null || secciones === 0) return null;
  const todas = verificadas === secciones;
  return (
    <span className="inline-flex items-center gap-1.5" title="Secciones ancladas al documento">
      <span
        aria-hidden
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${todas ? "bg-verified" : "bg-warning"}`}
      />
      <span className={todas ? "text-muted" : "text-warning"}>
        <span className="tabular">
          {verificadas} de {secciones}
        </span>{" "}
        ancladas
      </span>
    </span>
  );
}
