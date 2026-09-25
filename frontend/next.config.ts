import type { NextConfig } from "next";

// Proxy al backend: el navegador llama a /api/* (mismo origen) y Next lo reenvía al
// backend FastAPI. Evita CORS en desarrollo y no requiere cambios en el backend.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/:path*` }];
  },
};

export default nextConfig;
