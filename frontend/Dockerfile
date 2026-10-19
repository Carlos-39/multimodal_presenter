# syntax=docker/dockerfile:1

# Imagen del frontend.
#
# Tres etapas, y la última se queda con muy poco: Next construye una salida «standalone» que trae
# solo los módulos que el servidor de verdad usa, en vez de los 155 paquetes de `node_modules`.
#
# Este contenedor es el que da la cara: el navegador habla solo con él, y él reenvía `/api/*` al
# backend por la red privada. Por eso aquí viven el portón y la política de contenido.

# ────────────────────────────── 1. dependencias ──────────────────────────────
FROM node:24-slim AS dependencias
WORKDIR /app
# `npm ci` y no `npm install`: instala exactamente lo que dice el candado, y falla si el candado
# y el manifiesto no coinciden. En una imagen eso es lo que se quiere, que no «arregle» nada sola.
#
# Y por eso la imagen es `node:24`, la misma mayor que uso yo: con `node:22` viene npm 10, que
# coloca dos paquetes anidados donde npm 11 los deja arriba, y `npm ci` se planta diciendo que el
# candado no cuadra. El candado no estaba mal; estaba escrito por otra versión de npm.
COPY package.json package-lock.json ./
RUN npm ci

# ─────────────────────────────── 2. construir ────────────────────────────────
FROM node:24-slim AS construccion
WORKDIR /app
COPY --from=dependencias /app/node_modules ./node_modules
COPY . .

# **A dónde reenviar `/api/*` se decide AQUÍ, al compilar, y no al arrancar.** Next serializa los
# `rewrites` en `routes-manifest.json` durante el build, así que la variable de ejecución llega
# tarde: el contenedor seguía intentando `127.0.0.1:8000` (él mismo) y respondía 500 con la
# variable correcta puesta en el entorno. Costó encontrarlo aquí; en la plataforma habría costado
# más, porque el síntoma no señala a la causa.
#
# Por eso entra como argumento de construcción. El valor por defecto es el de desarrollo, así que
# `npm run dev` fuera del contenedor no cambia.
ARG BACKEND_URL=http://127.0.0.1:8000
ENV BACKEND_URL=$BACKEND_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ──────────────────────────────── 3. servir ──────────────────────────────────
FROM node:24-slim AS final
WORKDIR /app

RUN useradd --create-home --uid 10001 app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    # `::` por lo mismo que el backend: la red privada de la plataforma puede ser IPv6, y
    # escuchando solo en IPv4 el borde no encuentra a este contenedor.
    HOSTNAME=:: \
    PORT=3000

# La salida standalone trae su propio `server.js` y los módulos justos. Los estáticos y `public/`
# van aparte porque Next los deja fuera de ese paquete a propósito.
COPY --from=construccion --chown=app:app /app/.next/standalone ./
COPY --from=construccion --chown=app:app /app/.next/static ./.next/static
COPY --from=construccion --chown=app:app /app/public ./public

USER app
EXPOSE 3000
CMD ["node", "server.js"]
