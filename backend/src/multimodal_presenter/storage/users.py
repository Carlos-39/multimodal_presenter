"""Cuentas y sesiones.

**Autenticación de PROTOTIPO, y conviene decirlo con esas palabras.** Lleva lo que no se puede
omitir sin que sea una irresponsabilidad —hash moderno de contraseña, cookie `HttpOnly`, sesiones
revocables— y no lleva verificación de correo, recuperación de contraseña, segundo factor ni
límite de intentos. Es una decisión de alcance declarada, no un olvido.

Sesiones guardadas en la base, no un JWT firmado. Un token guardado se puede revocar: cerrar
sesión borra la fila y deja de valer en el acto. Con un JWT habría que mantener una lista negra,
que es la misma tabla con más pasos, y además un secreto de firma que custodiar.
"""

from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime, timedelta

import aiosqlite
from argon2 import PasswordHasher

from .db import ahora

_hasher = PasswordHasher()

DURACION_SESION = timedelta(days=30)
MIN_LONGITUD_CONTRASENA = 8

# Hash de descarte, para gastar el mismo tiempo cuando el correo NO existe que cuando sí. Sin
# esto, la diferencia de tiempo entre "no existe" y "contraseña incorrecta" permite averiguar qué
# correos están registrados sin saber ninguna contraseña.
_HASH_SENUELO = _hasher.hash("contrasena-que-no-es-de-nadie")


class ErrorDeCuenta(Exception):
    """Algo que el usuario puede corregir (correo repetido, credenciales que no cuadran)."""


def _normaliza_email(email: str) -> str:
    return email.strip().lower()


def valida_email(email: str) -> str:
    """Comprobación deliberadamente simple, no RFC-5322.

    Validar correos de verdad es un problema sorprendentemente difícil y la biblioteca que lo
    hace bien consulta DNS por defecto, lo que fallaría sin conexión — justo en una sesión de
    evaluación. Para un prototipo, lo que importa es que haya una arroba y algo a cada lado.
    """
    limpio = _normaliza_email(email)
    local, arroba, dominio = limpio.partition("@")
    if not arroba or not local or "." not in dominio or " " in limpio:
        raise ErrorDeCuenta("El correo no parece válido.")
    return limpio


def valida_contrasena(contrasena: str) -> str:
    if len(contrasena) < MIN_LONGITUD_CONTRASENA:
        raise ErrorDeCuenta(
            f"La contraseña debe tener al menos {MIN_LONGITUD_CONTRASENA} caracteres."
        )
    return contrasena


async def crear_usuario(conn: aiosqlite.Connection, email: str, contrasena: str) -> str:
    """Crea la cuenta y devuelve su id. Lanza `ErrorDeCuenta` si el correo ya está."""
    limpio = valida_email(email)
    valida_contrasena(contrasena)

    async with conn.execute("SELECT 1 FROM usuarios WHERE email = ?", (limpio,)) as cur:
        if await cur.fetchone():
            raise ErrorDeCuenta("Ya existe una cuenta con ese correo.")

    usuario_id = f"usr-{uuid.uuid4().hex[:16]}"
    await conn.execute(
        "INSERT INTO usuarios (id, email, password_hash, creado_en) VALUES (?, ?, ?, ?)",
        (usuario_id, limpio, _hasher.hash(contrasena), ahora()),
    )
    await conn.commit()
    return usuario_id


async def verificar_credenciales(
    conn: aiosqlite.Connection, email: str, contrasena: str
) -> str | None:
    """Id del usuario si las credenciales cuadran; `None` si no.

    Devuelve `None` sin distinguir entre "ese correo no existe" y "la contraseña no es": contarlo
    permitiría averiguar quién está registrado. Por lo mismo se verifica contra un hash señuelo
    cuando el correo no existe, para que las dos ramas tarden lo mismo.
    """
    limpio = _normaliza_email(email)
    async with conn.execute(
        "SELECT id, password_hash FROM usuarios WHERE email = ?", (limpio,)
    ) as cur:
        fila = await cur.fetchone()

    hash_guardado = fila["password_hash"] if fila else _HASH_SENUELO
    try:
        _hasher.verify(hash_guardado, contrasena)
    except Exception:  # noqa: BLE001 — cualquier fallo de verificación es "no cuadra"
        return None
    return fila["id"] if fila else None


async def abrir_sesion(conn: aiosqlite.Connection, usuario_id: str) -> str:
    """Crea una sesión y devuelve su token (lo que va en la cookie)."""
    token = secrets.token_urlsafe(32)
    expira = datetime.now(UTC) + DURACION_SESION
    await conn.execute(
        "INSERT INTO sesiones (token, usuario_id, creada_en, expira_en) VALUES (?, ?, ?, ?)",
        (token, usuario_id, ahora(), expira.isoformat()),
    )
    await conn.commit()
    return token


async def cerrar_sesion(conn: aiosqlite.Connection, token: str) -> None:
    """Revoca la sesión. Borrar la fila es lo que hace que salir sea inmediato de verdad."""
    await conn.execute("DELETE FROM sesiones WHERE token = ?", (token,))
    await conn.commit()


async def usuario_de_sesion(conn: aiosqlite.Connection, token: str | None) -> aiosqlite.Row | None:
    """El usuario dueño de un token vigente, o `None`.

    Una sesión caducada se borra al encontrarla: así la tabla se limpia sola con el uso, sin
    necesidad de una tarea periódica que habría que recordar mantener.
    """
    if not token:
        return None
    async with conn.execute(
        "SELECT u.*, s.expira_en FROM sesiones s "
        "JOIN usuarios u ON u.id = s.usuario_id WHERE s.token = ?",
        (token,),
    ) as cur:
        fila = await cur.fetchone()
    if fila is None:
        return None
    if datetime.fromisoformat(fila["expira_en"]) <= datetime.now(UTC):
        await cerrar_sesion(conn, token)
        return None
    return fila
