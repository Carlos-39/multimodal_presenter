"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileAudio, FilePdf, FileText, Image as ImageIcon, Plus } from "@phosphor-icons/react";
import type { ResumenPresentacion, Usuario } from "@/lib/account";
import { borrarPresentacion, misPresentaciones, quienSoy } from "@/lib/account";
import type { SourceKind } from "@/lib/types";
import { fechaRelativa } from "@/lib/fechas";
import { AuthForm } from "@/components/shell/AuthForm";
import { BotonMecha, type MechaHandle } from "@/components/shell/BotonMecha";
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
const ICONOS: Record<SourceKind, typeof FileText> = {
  text: FileText,
  pdf: FilePdf,
  image: ImageIcon,
  audio: FileAudio,
};

export function BibliotecaClient() {
  const [usuario, setUsuario] = useState<Usuario | null | undefined>(undefined);
  const [lista, setLista] = useState<ResumenPresentacion[] | null>(null);

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

            <div className="mt-8">
              {lista === null ? (
                <Cargando />
              ) : lista.length === 0 ? (
                <Vacia />
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {lista.map((p) => (
                    <Tarjeta
                      key={p.id}
                      presentacion={p}
                      onBorrada={(id) => setLista((l) => (l ?? []).filter((x) => x.id !== id))}
                    />
                  ))}
                </ul>
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
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Cargando">
      {[0, 1, 2].map((i) => (
        <li key={i} className="skeleton h-28 rounded-xl" />
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
    <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
      <p className="mx-auto max-w-[36ch] font-serif text-[1.0625rem] leading-[1.6] text-foreground-secondary">
        Aquí van a aparecer los documentos que transformes y guardes, con su conversación y lo que
        hayas generado.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
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

      <Link
        href={`/?abrir=${encodeURIComponent(id)}`}
        aria-hidden={yendose}
        tabIndex={yendose ? -1 : undefined}
        className={`group flex h-full flex-col rounded-xl border bg-surface p-4 transition-all ${
          yendose
            ? "pointer-events-none border-border opacity-45"
            : "border-border hover:border-accent"
        }`}
      >
        <div className="flex items-start gap-2.5">
          <Icono size={16} aria-hidden className="mt-0.5 shrink-0 text-muted" />
          <h2
            className={`min-w-0 flex-1 font-serif text-[0.9375rem] leading-snug text-foreground ${
              // El hueco crece con el botón: armado pasa de icono a «Deshacer 5» y, con el hueco
              // de reposo, se montaba encima del título.
              yendose ? "pr-24" : "pr-7"
            }`}
          >
            {titulo}
          </h2>
        </div>
        <p className="mt-auto pt-4 text-xs text-muted">
          {nombre_archivo ? (
            <span className="block truncate" title={nombre_archivo}>
              {nombre_archivo}
            </span>
          ) : null}
          <span className="tabular">{fechaRelativa(creada_en)}</span>
        </p>
      </Link>
      </FilaDeslizable>
    </li>
  );
}
