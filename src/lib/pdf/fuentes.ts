import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Fuentes de la marca (Barlow para títulos, Inter para el texto), las mismas
// de la app. Se leen de @fontsource (licencia SIL OFL 1.1) en formato WOFF.
// Cada familia tiene dos archivos: latín (español completo) y latín extendido
// (nombres con ł, ș, ő…), que el PDF combina carácter a carácter.
// next.config.ts incluye estos archivos en la función de Vercel
// (outputFileTracingIncludes).

export type BytesFuente = { latin: Uint8Array; latinExt: Uint8Array };
export type FuentesInforme = {
  titulo: BytesFuente;
  normal: BytesFuente;
  seminegrita: BytesFuente;
  negrita: BytesFuente;
};

// Rutas literales: el empaquetado de Vercel incluye solo estos 8 archivos.
const RUTAS = {
  titulo: ["node_modules/@fontsource/barlow/files/barlow-latin-800-italic.woff", "node_modules/@fontsource/barlow/files/barlow-latin-ext-800-italic.woff"],
  normal: ["node_modules/@fontsource/inter/files/inter-latin-400-normal.woff", "node_modules/@fontsource/inter/files/inter-latin-ext-400-normal.woff"],
  seminegrita: ["node_modules/@fontsource/inter/files/inter-latin-600-normal.woff", "node_modules/@fontsource/inter/files/inter-latin-ext-600-normal.woff"],
  negrita: ["node_modules/@fontsource/inter/files/inter-latin-700-normal.woff", "node_modules/@fontsource/inter/files/inter-latin-ext-700-normal.woff"],
} as const satisfies Record<keyof FuentesInforme, readonly [string, string]>;

async function par([latin, latinExt]: readonly [string, string]): Promise<BytesFuente> {
  const [a, b] = await Promise.all([readFile(join(process.cwd(), latin)), readFile(join(process.cwd(), latinExt))]);
  return { latin: a, latinExt: b };
}

let cache: Promise<FuentesInforme> | null = null;

export function cargarFuentes(): Promise<FuentesInforme> {
  cache ??= (async () => ({
    titulo: await par(RUTAS.titulo),
    normal: await par(RUTAS.normal),
    seminegrita: await par(RUTAS.seminegrita),
    negrita: await par(RUTAS.negrita),
  }))().catch((e) => {
    cache = null;
    throw e;
  });
  return cache;
}
