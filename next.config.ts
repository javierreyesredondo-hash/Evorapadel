import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Evaluaciones y objetivos solo existen en la demostración (datos ficticios).
  // Las URL antiguas siguen funcionando. Temporales: cuando se conecten a la
  // base de datos volverán a estas rutas.
  async redirects() {
    return [
      { source: "/evaluaciones/:ruta*", destination: "/demo/evaluaciones/:ruta*", permanent: false },
      { source: "/objetivos/:ruta*", destination: "/demo/objetivos/:ruta*", permanent: false },
    ];
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
