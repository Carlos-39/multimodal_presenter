-- El anclaje sube al listado.
--
-- La biblioteca enseñaba el título, el tipo de fuente y la fecha, y nada de lo único que
-- distingue a este sistema: cuántas de sus secciones quedaron ancladas al documento. Eso vive en
-- el payload, y el listado NO puede leer el payload, un deck con ilustraciones son megas por
-- fila, y la lista solo necesita dos enteros.
--
-- Así que los dos enteros se guardan al guardar. Se calculan una vez, no en cada listado.
ALTER TABLE presentaciones ADD COLUMN secciones INTEGER;
ALTER TABLE presentaciones ADD COLUMN verificadas INTEGER;

-- Las que ya existan se rellenan ahora, leyendo su payload de una vez. Es caro y da igual: pasa
-- una sola vez, al migrar, y no en cada vez que alguien abre su biblioteca.
UPDATE presentaciones
SET secciones = json_extract(payload_json, '$.grounding.total_sections'),
    verificadas = json_extract(payload_json, '$.grounding.verified_sections')
WHERE secciones IS NULL;
