import type { NextConfig } from "next";

// Proxy al backend: el navegador llama a /api/* (mismo origen) y Next lo reenvía al
// backend FastAPI. Evita CORS en desarrollo y no requiere cambios en el backend.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

/**
 * Cabeceras de seguridad que NO dependen de la petición, así que no tienen por qué pasar por el
 * `proxy`: se declaran una vez y valen para todo, incluidos los archivos estáticos.
 *
 * La política de contenido es la excepción y vive en `proxy.ts`, porque necesita un *nonce* nuevo
 * cada vez.
 */
const CABECERAS_DE_SEGURIDAD = [
  // Dos años. Sin `includeSubDomains` ni `preload` a propósito: mientras esto viva bajo el
  // subdominio de una plataforma, comprometer a los vecinos o entrar en una lista de la que se
  // sale a mano no es nuestro a decidir.
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Lo mismo que `frame-ancestors 'none'`, para navegadores que no entienden aquello.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // **El micrófono se queda**: la pregunta por voz del chat lo necesita, y una lista de permisos
  // copiada de cualquier sitio lo habría apagado sin que nadie se enterara hasta usarlo.
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), " +
      "magnetometer=(), microphone=(self), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  // El indicador flotante de desarrollo cae justo sobre el control de narración (esquina inferior
  // izquierda). Se oculta; los errores de compilación/ejecución se siguen mostrando.
  devIndicators: false,
  // Sin `X-Powered-By`: decir con qué está hecho el servidor no ayuda a nadie que no sea quien
  // busca una versión con un fallo conocido.
  poweredByHeader: false,
  // Salida autocontenida para la imagen: Next copia su propio servidor y SOLO los módulos que de
  // verdad usa, en vez de arrastrar los 155 paquetes de `node_modules`. No cambia nada en
  // desarrollo; solo decide qué deja `next build` en disco.
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: CABECERAS_DE_SEGURIDAD }];
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/:path*` }];
  },
};

export default nextConfig;
