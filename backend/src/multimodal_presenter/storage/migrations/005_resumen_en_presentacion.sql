-- Un asomo de lo que hay dentro, en el listado.
--
-- La tarjeta enseñaba título, tipo, fecha y anclaje, y nada de lo que la presentación DICE. Con
-- seis guardadas del mismo documento, el título no basta para saber cuál es cuál.
--
-- Mismo criterio que el anclaje en la 004: el texto vive en el payload y el listado no puede leer
-- el payload, así que sube una columna, recortada ya al guardar. No es el resumen del documento:
-- es el principio de la primera sección, que es lo primero que alguien leería al abrirla.
ALTER TABLE presentaciones ADD COLUMN resumen TEXT;

-- Las que ya existan se rellenan ahora, de una vez.
UPDATE presentaciones
SET resumen = substr(json_extract(payload_json, '$.presentation.sections[0].content.text'), 1, 240)
WHERE resumen IS NULL;
