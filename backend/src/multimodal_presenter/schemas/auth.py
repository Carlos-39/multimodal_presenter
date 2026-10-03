"""Contrato de las cuentas. Aparte del contrato de datos a propósito.

`Presentation` y compañía describen el resultado de una transformación; esto describe quién
entra. Mantenerlos separados es lo que impide que un identificador de usuario acabe dentro de un
prompt: lo que no está en el contrato de datos no puede viajar con él a un modelo.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CredencialesRequest(_Strict):
    """Entrada de registro e inicio de sesión. Misma forma para las dos."""

    email: str = Field(min_length=3, max_length=254)
    contrasena: str = Field(min_length=1, max_length=256)
    """Sin tope mínimo AQUÍ a propósito: la regla de longitud vive en un solo sitio
    (`storage.users.valida_contrasena`), para que el mensaje de error sea el mismo se entre por
    donde se entre."""


class UsuarioResponse(_Strict):
    """Quién está dentro. Nunca incluye el hash ni el token: no hacen falta en el navegador."""

    id: str
    email: str
