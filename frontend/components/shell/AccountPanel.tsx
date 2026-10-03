"use client";

import { useEffect, useState } from "react";
import { X } from "@phosphor-icons/react";
import {
  borrarPresentacion,
  entrar,
  misPresentaciones,
  registrarse,
  salir,
  type ResumenPresentacion,
  type Usuario,
} from "@/lib/account";

/**
 * Cuenta y biblioteca en un solo panel.
 *
 * Sin sesión muestra el formulario de entrada; con sesión, "mis presentaciones". Están juntos
 * porque son la misma pregunta vista desde dos momentos —"¿quién eres?" y "¿qué guardaste?"— y
 * separarlos obligaría a quien entra a buscar dónde está lo suyo.
 *
 * **Entrar es opcional.** Todo lo demás de la aplicación funciona sin cuenta: las sesiones de
 * evaluación del Hito 8 corren así. Este panel añade *guardar y volver*, nada más, y por eso se
 * abre desde un botón en vez de interponerse al arrancar.
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
  const [email, setEmail] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [modo, setModo] = useState<"entrar" | "registro">("entrar");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
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
        // La lista vacía es un estado válido; un fallo no debe dejar el panel colgado cargando.
        if (vigente) setLista([]);
      });
    return () => {
      vigente = false;
    };
  }, [usuario, version]);

  async function envia(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const fn = modo === "entrar" ? entrar : registrarse;
      onUsuario(await fn(email.trim(), contrasena));
      setContrasena("");
    } catch (e) {
      // El mensaje viene del backend y es deliberadamente vago al entrar ("correo o contraseña
      // incorrectos"): distinguirlos permitiría averiguar quién tiene cuenta.
      setError(e instanceof Error ? e.message : "No se pudo completar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <aside className="section-enter flex h-full w-full flex-col bg-surface">
      <header className="flex items-center justify-between border-b border-border py-2 pl-4 pr-2">
        <h2 className="text-[0.8125rem] font-medium text-foreground">
          {usuario ? "Mis presentaciones" : "Entrar"}
        </h2>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar el panel de cuenta"
          title="Cerrar"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
        >
          <X size={15} aria-hidden />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
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
          <form onSubmit={envia} className="flex flex-col gap-3">
            <p className="text-xs leading-5 text-muted">
              Entrar sirve para guardar tus presentaciones y volver a ellas. La aplicación
              funciona igual sin cuenta.
            </p>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Correo
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-md border border-border bg-surface-sunken px-2.5 py-1.5 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Contraseña
              <input
                type="password"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                required
                className="rounded-md border border-border bg-surface-sunken px-2.5 py-1.5 text-sm text-foreground"
              />
            </label>
            {error ? (
              <p className="rounded-md border border-warning/40 px-2.5 py-1.5 text-xs text-warning">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={enviando}
              className="rounded-md bg-accent-subtle px-3 py-1.5 text-sm text-accent transition-colors hover:text-accent-hover disabled:opacity-50"
            >
              {enviando ? "…" : modo === "entrar" ? "Entrar" : "Crear cuenta"}
            </button>
            <button
              type="button"
              onClick={() => {
                setModo(modo === "entrar" ? "registro" : "entrar");
                setError(null);
              }}
              className="text-xs text-accent underline decoration-1 underline-offset-2 hover:text-accent-hover"
            >
              {modo === "entrar" ? "No tengo cuenta" : "Ya tengo cuenta"}
            </button>
          </form>
        )}
      </div>
    </aside>
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
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-muted">{usuario.email}</span>
        <button
          type="button"
          onClick={() => void onSalir()}
          className="shrink-0 text-xs text-accent underline decoration-1 underline-offset-2 hover:text-accent-hover"
        >
          Salir
        </button>
      </div>

      {lista === null ? (
        <div className="h-20 animate-pulse rounded-md bg-surface-sunken" />
      ) : lista.length === 0 ? (
        <p className="text-xs leading-5 text-muted">
          Todavía no has guardado nada. Transforma un documento y pulsa «Guardar».
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {lista.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-2 rounded-md border border-border px-2.5 py-2"
            >
              <button
                type="button"
                onClick={() => onAbrir(p.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-sm text-foreground">{p.titulo}</span>
                <span className="block truncate text-xs text-muted">
                  {p.nombre_archivo ?? "texto pegado"} ·{" "}
                  {new Date(p.creada_en).toLocaleDateString("es")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => void onBorrar(p.id)}
                aria-label={`Borrar ${p.titulo}`}
                title="Borrar"
                className="shrink-0 text-xs text-muted transition-colors hover:text-warning"
              >
                Borrar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
