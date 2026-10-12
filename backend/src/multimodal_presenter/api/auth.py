"""Endpoints de cuenta: registrarse, entrar, salir y saber quién está dentro.

**El modo invitado no es una cortesía: es un requisito.** Sin cuenta, la aplicación entera sigue
funcionando exactamente como antes — y tiene que seguir siendo así, porque las sesiones de
evaluación del Hito 8 corren sin login. Entrar añade *guardar y volver*; no habilita usar el
sistema. Por eso existen dos dependencias: `usuario_actual` para lo que sí exige cuenta, y
`usuario_opcional` para todo lo demás.

La telemetría del Hito 8 **no se toca y no debe tocarse**: sigue identificando sesiones por
`sessionStorage` y `?p=Pxx`, sin login. El consentimiento informado promete anonimato por Pxx, y
atarla a una cuenta la volvería identificable.
"""

from __future__ import annotations

import aiosqlite
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response

from ..config import Settings, get_settings
from ..schemas.auth import CredencialesRequest, UsuarioResponse
from ..storage import conectar
from ..storage.users import (
    DURACION_SESION,
    ErrorDeCuenta,
    abrir_sesion,
    cerrar_sesion,
    crear_usuario,
    usuario_de_sesion,
    verificar_credenciales,
)
from .limites import Intentos, exige_cupo, ip_del_cliente

router = APIRouter(prefix="/auth", tags=["cuenta"])

COOKIE = "mmp_sesion"

#: Contador de fallos compartido por los dos endpoints que piden credenciales. Es de módulo
#: porque tiene que sobrevivir a la petición: un contador por petición no cuenta nada.
_intentos = Intentos()


def _llaves(request: Request, email: str, settings: Settings) -> tuple[str, ...]:
    """Las dos llaves con las que se cuenta este intento: la dirección y el correo.

    El correo se normaliza igual que al guardarlo, o `Carlos@X.com` y `carlos@x.com` tendrían
    contadores distintos y el límite se esquivaría cambiando una mayúscula.
    """
    return (
        f"ip:{ip_del_cliente(request, settings.proxies_confiables)}",
        f"correo:{email.strip().lower()}",
    )


def _pon_cookie(respuesta: Response, token: str, settings: Settings) -> None:
    """Cookie `HttpOnly`: el token no se toca desde JavaScript, así un XSS no se lleva la sesión.

    `secure` solo fuera de desarrollo: en local la aplicación va por http y una cookie `secure`
    no se guardaría, con lo que entrar no funcionaría en la máquina donde se desarrolla.
    """
    respuesta.set_cookie(
        COOKIE,
        token,
        httponly=True,
        samesite="lax",
        secure=settings.environment != "development",
        max_age=int(DURACION_SESION.total_seconds()),
        path="/",
    )


async def usuario_opcional(
    mmp_sesion: str | None = Cookie(default=None),
    settings: Settings = Depends(get_settings),
) -> aiosqlite.Row | None:
    """Quién está dentro, o `None`. Para todo lo que funciona igual sin cuenta."""
    async with conectar(settings) as conn:
        return await usuario_de_sesion(conn, mmp_sesion)


async def usuario_actual(
    usuario: aiosqlite.Row | None = Depends(usuario_opcional),
) -> aiosqlite.Row:
    """Quién está dentro, o 401. Solo para lo que de verdad exige cuenta."""
    if usuario is None:
        raise HTTPException(status_code=401, detail="Necesitas iniciar sesión.")
    return usuario


@router.post("/registro", response_model=UsuarioResponse, status_code=201)
async def registro_endpoint(
    datos: CredencialesRequest,
    respuesta: Response,
    request: Request,
    settings: Settings = Depends(get_settings),
) -> UsuarioResponse:
    """Crea la cuenta y deja la sesión abierta: registrarse y tener que entrar es un paso de más.

    Se puede cerrar con `REGISTRO_ABIERTO=false`, y viene cerrado. Cerrarlo **no** cierra el login
    ni toca el modo invitado: son tres cosas distintas y así se pueden decidir por separado.

    El límite de intentos también cuenta aquí, y no por simetría: el error de «ese correo ya está
    registrado» es un oráculo de quién tiene cuenta. Sin límite, se puede preguntar por una lista
    entera de correos; con él, por cinco cada cuarto de hora.
    """
    if not settings.registro_abierto:
        raise HTTPException(
            status_code=403,
            detail="El registro de cuentas nuevas está cerrado.",
        )

    llaves = _llaves(request, datos.email, settings)
    exige_cupo(_intentos, llaves)
    async with conectar(settings) as conn:
        try:
            usuario_id = await crear_usuario(conn, datos.email, datos.contrasena)
        except ErrorDeCuenta as exc:
            for llave in llaves:
                _intentos.falla(llave)
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        token = await abrir_sesion(conn, usuario_id)
    for llave in llaves:
        _intentos.acierta(llave)
    _pon_cookie(respuesta, token, settings)
    return UsuarioResponse(id=usuario_id, email=datos.email.strip().lower())


@router.post("/entrar", response_model=UsuarioResponse)
async def entrar_endpoint(
    datos: CredencialesRequest,
    respuesta: Response,
    request: Request,
    settings: Settings = Depends(get_settings),
) -> UsuarioResponse:
    """Inicia sesión.

    El mensaje de error no distingue entre correo desconocido y contraseña incorrecta: contarlo
    permitiría averiguar quién tiene cuenta sin saber ninguna contraseña.

    **Y por eso mismo el límite de intentos cuenta igual los dos casos.** Si solo contara las
    contraseñas falladas de cuentas que existen, el 429 aparecería únicamente con correos
    registrados y sería el oráculo que el mensaje de error evita con tanto cuidado.
    """
    llaves = _llaves(request, datos.email, settings)
    exige_cupo(_intentos, llaves)
    async with conectar(settings) as conn:
        usuario_id = await verificar_credenciales(conn, datos.email, datos.contrasena)
        if usuario_id is None:
            for llave in llaves:
                _intentos.falla(llave)
            raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos.")
        token = await abrir_sesion(conn, usuario_id)
    for llave in llaves:
        _intentos.acierta(llave)
    _pon_cookie(respuesta, token, settings)
    return UsuarioResponse(id=usuario_id, email=datos.email.strip().lower())


@router.post("/salir", status_code=204)
async def salir_endpoint(
    respuesta: Response,
    mmp_sesion: str | None = Cookie(default=None),
    settings: Settings = Depends(get_settings),
) -> Response:
    """Cierra la sesión. Borra la fila además de la cookie: el token deja de valer en el acto.

    Responde 204 aunque no hubiera sesión: salir cuando ya estabas fuera no es un error.
    """
    if mmp_sesion:
        async with conectar(settings) as conn:
            await cerrar_sesion(conn, mmp_sesion)
    respuesta.delete_cookie(COOKIE, path="/")
    return Response(status_code=204)


@router.get("/yo", response_model=UsuarioResponse | None)
async def yo_endpoint(
    usuario: aiosqlite.Row | None = Depends(usuario_opcional),
) -> UsuarioResponse | None:
    """Para que el frontend sepa al cargar si hay sesión. Sin sesión responde `null`, no 401.

    No tener cuenta no es un error: es el estado NORMAL de esta aplicación, el que usan las
    sesiones de evaluación del Hito 8. Con 401, cada carga sin sesión pintaba dos errores rojos en
    la consola del navegador por algo que estaba funcionando como debía — y un error que no lo es
    enseña a ignorar los que sí lo son.
    """
    if usuario is None:
        return None
    return UsuarioResponse(id=usuario["id"], email=usuario["email"])
