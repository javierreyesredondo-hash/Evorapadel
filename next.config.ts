import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
