"use client";

import { useEffect, useState } from "react";
import {
  FileAudio,
  FilePdf,
  FileText,
  Image as ImageIcon,
  SignOut,
  Trash,
  X,
} from "@phosphor-icons/react";
import {
  borrarPresentacion,
  misPresentaciones,
  salir,
  type ResumenPresentacion,
  type Usuario,
} from "@/lib/account";
import { fechaRelativa } from "@/lib/fechas";
import type { SourceKind } from "@/lib/types";
import { Avatar } from "./AccountButton";
import { AuthForm } from "./AuthForm";

/**
 * Cuenta y biblioteca en un solo cajón.
 *
 * Sin sesión muestra el acceso; con sesión, lo guardado. Están juntos porque son la misma pregunta
 * vista desde dos momentos —«¿quién eres?» y «¿qué guardaste?»— y separarlos obligaría a quien
 * entra a buscar dónde está lo suyo.
 *
 * **Entrar es opcional.** Todo lo demás de la aplicación funciona sin cuenta: las sesiones de
 * evaluación del Hito 8 corren así. Este cajón añade *guardar y volver*, nada más, y por eso se
 * abre desde un botón en vez de interponerse al arrancar.
 *
 * El formulario de acceso no vive aquí sino en `AuthForm`, para que la futura landing lo reuse en
 * vez de copiarlo.
 */
export function AccountPanel({
  usuario,
  onUsuario,
  onAbrir,
  onBorrada,
  onCerrar,
}: {
  usuario: Usuario | null;
  onUsuario: (u: Usuario | null) => void;
  onAbrir: (id: string) => void;
  /** Avisa de qué se borró: si era la que se está viendo, deja de haber dónde guardar su chat. */
  onBorrada: (id: string) => void;
  onCerrar: () => void;
}) {
  const [lista, setLista] = useState<ResumenPresentacion[] | null>(null);

  // `version` fuerza una recarga tras borrar, sin duplicar la lógica de carga en dos sitios.
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!usuario) {
      return;
    }
    // El guardián descarta una respuesta que llegue tarde: si se sale y entra otra cuenta
    // deprisa, la lista de la anterior no debe pisar a la nueva.
    let vigente = true;
    misPresentaciones()
      .then((p) => {
        if (vigente) setLista(p);
      })
      .catch(() => {
        // La lista vacía es un estado válido; un fallo no debe dejar el cajón colgado cargando.
        if (vigente) setLista([]);
      });
    return () => {
      vigente = false;
    };
  }, [usuario, version]);

  return (
    <aside className="flex h-full w-full flex-col bg-surface">
      <Cabecera usuario={usuario} total={lista?.length ?? null} onCerrar={onCerrar} />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {usuario ? (
          <Biblioteca
            usuario={usuario}
            lista={lista}
            onAbrir={onAbrir}
            onBorrar={async (id) => {
              await borrarPresentacion(id);
              onBorrada(id);
              setVersion((v) => v + 1);
            }}
            onSalir={async () => {
              await salir();
              onUsuario(null);
              setLista(null);
            }}
          />
        ) : (
          <AuthForm onUsuario={onUsuario} />
        )}
      </div>
    </aside>
  );
}

/**
 * La cabecera del cajón lleva el nombre de la aplicación, no solo el título de la sección.
 *
 * Un cajón que se desliza sobre el contenido tapa la cabecera de la página, y durante ese rato es
 * lo único que se ve. Sin nombre parecería una ventana ajena pegada encima.
 */
function Cabecera({
  usuario,
  total,
  onCerrar,
}: {
  usuario: Usuario | null;
  total: number | null;
  onCerrar: () => void;
}) {
  return (
    <header className="flex items-start justify-between gap-2 border-b border-border bg-surface-sunken/40 py-3 pl-4 pr-2">
      <div className="min-w-0">
        <p className="truncate text-[0.8125rem] font-semibold tracking-tight text-foreground">
          Multimodal Presenter
        </p>
        <p className="truncate text-xs text-muted">
          {!usuario
            ? "Entra para guardar tu trabajo"
            : total === null
              ? "Tu biblioteca"
              : total === 0
                ? "Tu biblioteca, todavía vacía"
                : `Tu biblioteca · ${total} ${total === 1 ? "presentación" : "presentaciones"}`}
        </p>
      </div>
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar el panel de cuenta"
        title="Cerrar"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
      >
        <X size={15} aria-hidden />
      </button>
    </header>
  );
}

function Biblioteca({
  usuario,
  lista,
  onAbrir,
  onBorrar,
  onSalir,
}: {
  usuario: Usuario;
  lista: ResumenPresentacion[] | null;
  onAbrir: (id: string) => void;
  onBorrar: (id: string) => Promise<void>;
  onSalir: () => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <Avatar email={usuario.email} grande />
        <span className="min-w-0 flex-1 truncate text-sm text-foreground" title={usuario.email}>
          {usuario.email}
        </span>
        <button
          type="button"
          onClick={() => void onSalir()}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
        >
          <SignOut size={15} aria-hidden />
        </button>
      </div>

      {lista === null ? (
        <div className="flex flex-col gap-1.5" role="status" aria-label="Cargando tu biblioteca">
          <div className="skeleton h-14 rounded-lg" />
          <div className="skeleton h-14 rounded-lg" />
        </div>
      ) : lista.length === 0 ? (
        <Vacia />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {lista.map((p) => (
            <Fila key={p.id} presentacion={p} onAbrir={onAbrir} onBorrar={onBorrar} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** El estado vacío dice qué hacer, no solo que no hay nada. */
function Vacia() {
  return (
    <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center">
      <p className="text-xs leading-5 text-muted">
        Todavía no has guardado nada.
        <br />
        Transforma un documento y pulsa <span className="text-foreground">Guardar</span>.
      </p>
    </div>
  );
}

/**
 * Una presentación guardada.
 *
 * Toda la fila abre, menos el botón de borrar. Borrar es un icono y no la palabra «Borrar»: con
 * texto competía en peso con el título y parecía la acción principal de una fila cuya acción
 * principal es abrirla.
 */
function Fila({
  presentacion,
  onAbrir,
  onBorrar,
}: {
  presentacion: ResumenPresentacion;
  onAbrir: (id: string) => void;
  onBorrar: (id: string) => Promise<void>;
}) {
  const { id, titulo, source_kind, nombre_archivo, creada_en } = presentacion;
  return (
    <li className="group relative rounded-lg border border-border transition-colors hover:border-border-strong hover:bg-surface-sunken/50">
      <button
        type="button"
        onClick={() => onAbrir(id)}
        className="flex w-full items-start gap-2.5 px-2.5 py-2 pr-9 text-left"
      >
        <span className="mt-0.5 shrink-0 text-muted">
          <IconoDeFuente kind={source_kind} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm leading-5 text-foreground">{titulo}</span>
          <span className="block truncate text-xs text-muted">
            {nombre_archivo ?? "Texto pegado"} · {fechaRelativa(creada_en)}
          </span>
        </span>
      </button>
      {/* Visible siempre en pantallas táctiles (no hay «pasar por encima») y al enfocar con el
          teclado; en ratón aparece al acercarse, para que no compita con el título. */}
      <button
        type="button"
        onClick={() => void onBorrar(id)}
        aria-label={`Borrar ${titulo}`}
        title="Borrar"
        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md text-muted opacity-100 transition-all hover:bg-surface hover:text-warning focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
      >
        <Trash size={14} aria-hidden />
      </button>
    </li>
  );
}

/** De qué salió la presentación. Es lo que distingue dos títulos parecidos de un vistazo. */
function IconoDeFuente({ kind }: { kind: SourceKind }) {
  const tamano = 16;
  switch (kind) {
    case "pdf":
      return <FilePdf size={tamano} aria-hidden />;
    case "image":
      return <ImageIcon size={tamano} aria-hidden />;
    case "audio":
      return <FileAudio size={tamano} aria-hidden />;
    default:
      return <FileText size={tamano} aria-hidden />;
  }
}
