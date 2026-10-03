"""Persistencia: cuentas, documentos guardados y lo que se genera a partir de ellos.

Vive aparte del pipeline a propósito. El contrato de datos describe el RESULTADO de una
transformación; la propiedad es del acto de guardarlo, no del resultado. Mantener esa capa fuera
también impide, por construcción, que un identificador de usuario acabe dentro de un prompt:
`Presentation` viaja a los modelos, y lo que no está dentro del contrato no puede viajar con él.
"""

from .db import conectar, db_path, migrar, resolve_data_dir

__all__ = ["conectar", "db_path", "migrar", "resolve_data_dir"]
