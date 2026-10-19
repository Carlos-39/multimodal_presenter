"use client";

import { useEffect, useState } from "react";
import { BookmarkSimple, ChatCircleText, FilmSlate } from "@phosphor-icons/react";
import { entrar, registrarse, registroAbierto, type Usuario } from "@/lib/account";

/**
 * Entrar o crear cuenta. Componente propio y no un trozo del panel, a propósito.
 *
 * Esta pantalla va a aparecer en más de un sitio: hoy en el cajón de cuenta, mañana en la landing
 * que presente la aplicación. Si viviera dentro del panel, la landing acabaría con una copia, y
 * dos copias de un formulario de acceso divergen en silencio, que es la peor forma de divergir.
 *
 * No sabe dónde está montado: recibe `onUsuario` y avisa de quién entró. Quien lo coloca decide
 * qué hacer después (cerrar el cajón, navegar a la aplicación, lo que sea).
 */
export function AuthForm({
  onUsuario,
  conVentajas = true,
}: {
  onUsuario: (u: Usuario) => void;
  /** Las tres líneas de «para qué sirve». Una landing que ya las cuente puede apagarlas. */
  conVentajas?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [modo, setModo] = useState<"entrar" | "registro">("entrar");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  /** `null` mientras no se sabe. Hasta saberlo no se ofrece crear cuenta. */
  const [sePuedeCrear, setSePuedeCrear] = useState<boolean | null>(null);

  useEffect(() => {
    let vivo = true;
    registroAbierto().then((abierto) => {
      if (vivo) setSePuedeCrear(abierto);
    });
    return () => {
      vivo = false;
    };
  }, []);

  // El modo se DERIVA en vez de corregirse con un `setModo` en un efecto: así no hay un instante
  // en el que el formulario esté en «crear cuenta» con el registro cerrado, y se respeta la regla
  // de pureza del proyecto, que prohíbe `setState` síncrono dentro de un efecto.
  const modoReal = sePuedeCrear === true ? modo : "entrar";

  async function envia(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const fn = modoReal === "entrar" ? entrar : registrarse;
      onUsuario(await fn(email.trim(), contrasena));
      setContrasena("");
    } catch (e) {
      // El mensaje viene del backend y al entrar es deliberadamente vago ("correo o contraseña
      // incorrectos"): distinguirlos permitiría averiguar quién tiene cuenta.
      setError(e instanceof Error ? e.message : "No se pudo completar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {conVentajas ? <Ventajas /> : null}

      <form onSubmit={envia} className="flex flex-col gap-3">
        <Campo etiqueta="Correo" tipo="email" valor={email} onCambio={setEmail} autoComplete="email" />
        <Campo
          etiqueta="Contraseña"
          tipo="password"
          valor={contrasena}
          onCambio={setContrasena}
          autoComplete={modoReal === "entrar" ? "current-password" : "new-password"}
        />

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-warning/40 bg-warning/5 px-2.5 py-1.5 text-xs leading-4 text-warning"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={enviando}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {enviando ? "Un momento…" : modoReal === "entrar" ? "Entrar" : "Crear cuenta"}
        </button>
      </form>

      {/* Con el registro cerrado NO se ofrece crear cuenta, y se dice por qué no hace falta. Una
          puerta pintada en una pared es peor que no tener puerta: el error llegaría después de
          escribir un correo y una contraseña, que es el peor momento para enterarse.

          Mientras no se sabe (`null`) no se pinta nada, para no ofrecerla y retirarla medio
          segundo después. */}
      {sePuedeCrear === true ? (
        <p className="text-center text-xs text-muted">
          {modoReal === "entrar" ? "¿Todavía no tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
          <button
            type="button"
            onClick={() => {
              setModo(modoReal === "entrar" ? "registro" : "entrar");
              setError(null);
            }}
            className="text-accent underline decoration-1 underline-offset-2 hover:text-accent-hover"
          >
            {modoReal === "entrar" ? "Crear una" : "Entrar"}
          </button>
        </p>
      ) : sePuedeCrear === false ? (
        <p className="text-center text-xs leading-4 text-muted">
          No hay cuentas nuevas por ahora. La aplicación funciona completa sin entrar: la cuenta
          solo añade guardar y volver.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Qué gana quien entra. Tres cosas concretas y no un eslogan: la aplicación funciona igual sin
 * cuenta, así que lo honesto es decir exactamente qué añade en vez de insinuar que hace falta.
 */
function Ventajas() {
  const items = [
    { icono: <BookmarkSimple size={15} aria-hidden />, texto: "Guarda lo que transformes y vuelve cuando quieras" },
    { icono: <ChatCircleText size={15} aria-hidden />, texto: "Tus preguntas y sus citas siguen ahí al volver" },
    { icono: <FilmSlate size={15} aria-hidden />, texto: "Las diapositivas y la narración no se regeneran" },
  ];

  return (
    <ul className="flex flex-col gap-2 rounded-lg border border-border bg-surface-sunken/50 p-3">
      {items.map((item) => (
        <li key={item.texto} className="flex items-start gap-2 text-xs leading-4 text-foreground-secondary">
          <span className="mt-px shrink-0 text-accent">{item.icono}</span>
          {item.texto}
        </li>
      ))}
    </ul>
  );
}

function Campo({
  etiqueta,
  tipo,
  valor,
  onCambio,
  autoComplete,
}: {
  etiqueta: string;
  tipo: "email" | "password";
  valor: string;
  onCambio: (v: string) => void;
  autoComplete: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-foreground-secondary">
      {etiqueta}
      <input
        type={tipo}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        required
        autoComplete={autoComplete}
        className="rounded-md border border-border bg-background px-2.5 py-2 text-sm font-normal text-foreground transition-colors placeholder:text-muted hover:border-border-strong"
      />
    </label>
  );
}
