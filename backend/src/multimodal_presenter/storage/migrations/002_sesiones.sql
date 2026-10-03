-- Sesiones de usuario.
--
-- Se guardan en la base en vez de firmar un JWT, y la razón es práctica: un token guardado se
-- puede REVOCAR. Cerrar sesión borra la fila y el token deja de valer en el acto; con un JWT
-- firmado habría que mantener una lista negra, que es la misma tabla con más pasos. Además evita
-- tener que custodiar un secreto de firma: aquí el token ES el secreto, y solo vive en la cookie
-- de quien entró y en esta tabla.
CREATE TABLE sesiones (
    token      TEXT PRIMARY KEY,
    usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    creada_en  TEXT NOT NULL,
    expira_en  TEXT NOT NULL
);

CREATE INDEX idx_sesiones_usuario ON sesiones(usuario_id);
