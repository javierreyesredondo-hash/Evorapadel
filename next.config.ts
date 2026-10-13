import type { NextConfig } from "next";

// Cabeceras de seguridad para todas las respuestas. No limitan los scripts de
// Next (eso exigiría una CSP con nonces); impiden incrustar la app en webs
// ajenas (clickjacking), adivinar tipos de archivo y filtrar la URL completa
// (con identificadores de evaluaciones) a otros sitios.
const CABECERAS_SEGURIDAD = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: CABECERAS_SEGURIDAD }];
  },
  // pdf.js (importador de metodologías) se carga con el import nativo de Node:
  // su «worker» se importa dinámicamente desde el propio paquete.
  serverExternalPackages: ["pdfjs-dist"],
  // Fuentes del informe PDF (se leen del disco al generarlo): que viajen con la función en Vercel.
  outputFileTracingIncludes: {
    "/evaluaciones/*/pdf": [
      "./node_modules/@fontsource/inter/files/inter-latin-*-normal.woff",
      "./node_modules/@fontsource/inter/files/inter-latin-ext-*-normal.woff",
      "./node_modules/@fontsource/barlow/files/barlow-latin-800-italic.woff",
      "./node_modules/@fontsource/barlow/files/barlow-latin-ext-800-italic.woff",
    ],
    "/metodologia/importar/analizar": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
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
