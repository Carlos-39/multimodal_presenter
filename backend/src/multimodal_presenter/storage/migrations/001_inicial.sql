-- Esquema inicial: cuentas, documentos guardados y lo que se genera a partir de ellos.
--
-- El contrato de datos (Presentation/Section/SourceReference) NO aparece aquí como columnas: se
-- guarda como bloque OPACO en `presentaciones.payload_json`. La propiedad no es una propiedad del
-- resultado, sino del acto de guardarlo, y, sobre todo, `Presentation` viaja a los modelos (es
-- el cuerpo de /narration y /illustrations), así que un `usuario_id` dentro del contrato acabaría
-- en un prompt por una ruta perfectamente normal. Fuera, eso es imposible por construcción.

CREATE TABLE usuarios (
    id            TEXT PRIMARY KEY,
    -- COLLATE NOCASE: nadie espera que Carlos@x.com y carlos@x.com sean dos cuentas distintas.
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    creado_en     TEXT NOT NULL
);

-- Un documento subido. La clave es el `document_id` que YA calcula el pipeline:
-- `doc-{sha256(bytes)[:12]}`, direccionable por contenido. Dos personas que suban el mismo PDF
-- comparten esta fila y sus bytes, sin coordinación y sin duplicar nada.
--
-- Los bytes viven en disco, no aquí: mantiene la base pequeña y los archivos se pueden mirar a
-- mano. La ruta NO se guarda porque se deriva del id, una ruta guardada es una ruta que puede
-- quedar desincronizada del archivo real.
CREATE TABLE documentos (
    document_id    TEXT PRIMARY KEY,
    source_kind    TEXT NOT NULL,  -- text | pdf | image | audio
    nombre_archivo TEXT,           -- NULL si se pegó texto
    media_type     TEXT,           -- NULL si se pegó texto
    tamano_bytes   INTEGER NOT NULL,
    creado_en      TEXT NOT NULL
);

-- Quién tiene qué. Separada de `documentos` justamente para que compartir contenido no implique
-- compartir propiedad: el mismo documento puede estar en la biblioteca de varias personas.
CREATE TABLE propiedad (
    usuario_id  TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    document_id TEXT NOT NULL REFERENCES documentos(document_id) ON DELETE CASCADE,
    titulo      TEXT,
    creado_en   TEXT NOT NULL,
    abierto_en  TEXT,
    PRIMARY KEY (usuario_id, document_id)
);

-- Una presentación generada y guardada. `payload_json` lleva el envelope completo
-- (presentation + grounding + chart_notes + transcript) tal cual.
--
-- `version_contrato` no es ceremonia: el contrato ya cambió dos veces este mes (`start_s` en A1,
-- `region` en el resaltado por región). Sin este campo, el primer cambio dejaría ilegibles las
-- presentaciones ya guardadas de todo el mundo.
CREATE TABLE presentaciones (
    id               TEXT PRIMARY KEY,
    usuario_id       TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    document_id      TEXT NOT NULL REFERENCES documentos(document_id),
    version_contrato INTEGER NOT NULL,
    payload_json     TEXT NOT NULL,
    creada_en        TEXT NOT NULL
);

CREATE INDEX idx_presentaciones_usuario ON presentaciones(usuario_id, creada_en DESC);

-- El historial de chat se ata a la PRESENTACIÓN, no al usuario+documento: las respuestas están
-- ancladas a `section_id` concretos de ESA generación. Atado al documento, una regeneración
-- dejaría el historial apuntando a secciones que ya no existen.
CREATE TABLE mensajes_chat (
    id              TEXT PRIMARY KEY,
    presentacion_id TEXT NOT NULL REFERENCES presentaciones(id) ON DELETE CASCADE,
    orden           INTEGER NOT NULL,
    rol             TEXT NOT NULL,  -- user | assistant
    texto           TEXT NOT NULL,
    respuesta_json  TEXT,           -- solo assistant: el ChatResponse completo
    creado_en       TEXT NOT NULL
);

CREATE INDEX idx_mensajes_presentacion ON mensajes_chat(presentacion_id, orden);

-- Deck, ilustraciones y narración. Se guardan en vez de regenerarse, y el motivo no es el costo
-- (~$0.52 por revisita) sino que regenerar da un artefacto DISTINTO cada vez: si alguien guarda
-- "su" presentación y al volver el deck es otro, no era suya.
CREATE TABLE artefactos (
    presentacion_id TEXT NOT NULL REFERENCES presentaciones(id) ON DELETE CASCADE,
    tipo            TEXT NOT NULL,  -- deck | ilustraciones | narracion
    payload_json    TEXT,           -- deck e ilustraciones
    ruta_bytes      TEXT,           -- narración (mp3): no cabe cómodo en JSON
    creado_en       TEXT NOT NULL,
    PRIMARY KEY (presentacion_id, tipo)
);
