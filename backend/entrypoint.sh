#!/bin/sh
# Arranque del backend.
#
# Existe por una razón concreta: **el volumen no viene con nuestro dueño**. Donde esto se despliega
# el punto de montaje aparece a nombre de root, así que un proceso que no sea root no puede ni
# crear la carpeta de la base. Y correr el servidor como root para esquivar eso sería arreglar un
# problema de permisos regalando todos los permisos.
#
# Así que: si arrancamos como root, se ajusta el dueño del volumen y se baja a `app` para servir.
# Si ya arrancamos sin privilegios (en una plataforma que lo imponga), no hay nada que ajustar y se
# sigue igual. El contenedor funciona en los dos casos sin cambiarle nada.
#
# `exec` en los dos caminos: sin él, este script se queda de padre y se come la señal de apagado,
# así que un redespliegue mataría al servidor a lo bruto en vez de dejarle cerrar lo que tenga
# abierto.
set -e

: "${DATA_DIR:=/datos/base}"
: "${TELEMETRY_DIR:=/datos/telemetria}"

if [ "$(id -u)" = "0" ]; then
    mkdir -p "$DATA_DIR" "$TELEMETRY_DIR"
    # Solo las carpetas de datos. El resto de la imagen es de solo lectura para quien sirve.
    chown -R app:app "$DATA_DIR" "$TELEMETRY_DIR"
    exec gosu app "$@"
fi

mkdir -p "$DATA_DIR" "$TELEMETRY_DIR"
exec "$@"
