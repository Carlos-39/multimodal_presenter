-- El título pasa a la PRESENTACIÓN.
--
-- Estaba en `propiedad`, que es por (usuario, documento). Como el id de documento es
-- direccionable por contenido, dos presentaciones del mismo texto comparten documento — y por
-- tanto compartían título: la segunda se guardaba con el nombre de la primera. Se vio al probar
-- contra el backend real, guardando "Duendes rojos" y "Ciclo del agua" del mismo texto.
--
-- El título describe la presentación guardada, no el documento del que salió. En `propiedad`
-- queda solo lo que de verdad es de la relación usuario-documento: cuándo se añadió y cuándo se
-- abrió por última vez.
ALTER TABLE presentaciones ADD COLUMN titulo TEXT;

-- Las que ya existan heredan el título que tuviera su fila de propiedad, para no perderlo.
UPDATE presentaciones
SET titulo = (
    SELECT pr.titulo FROM propiedad pr
    WHERE pr.usuario_id = presentaciones.usuario_id
      AND pr.document_id = presentaciones.document_id
)
WHERE titulo IS NULL;
