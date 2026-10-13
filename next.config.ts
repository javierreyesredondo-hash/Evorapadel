import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El seguimiento de objetivos con progreso solo existe en la demostración.
  // Temporal: cuando se conecte a la base de datos volverá a esta ruta.
  // (/evaluaciones ya es real desde la fase de evaluaciones.)
  async redirects() {
    return [{ source: "/objetivos/:ruta*", destination: "/demo/objetivos/:ruta*", permanent: false }];
  },
  // Fuentes del informe PDF (se leen del disco al generarlo): que viajen con la función en Vercel.
  outputFileTracingIncludes: {
    "/evaluaciones/*/pdf": [
      "./node_modules/@fontsource/inter/files/inter-latin-*-normal.woff",
      "./node_modules/@fontsource/inter/files/inter-latin-ext-*-normal.woff",
      "./node_modules/@fontsource/barlow/files/barlow-latin-800-italic.woff",
      "./node_modules/@fontsource/barlow/files/barlow-latin-ext-800-italic.woff",
    ],
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
