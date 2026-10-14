#!/usr/bin/env node
// Servidor local mínimo para las escenas del vídeo.
//
//   node servidor.mjs            → http://127.0.0.1:4173/escenas/?t=12.5  (vista previa)
//
// Sirve esta carpeta y, en /datos/marca.js, los trazos ORIGINALES del logo de
// ÉVORA PADEL tal y como están en la app (src/components/marca/trazos.ts).

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const raiz = new URL(".", import.meta.url).pathname;
const repo = join(raiz, "../..");

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

async function marca() {
  const { SIMBOLO, PRINCIPAL, COMPACTA } = await import(join(repo, "src/components/marca/trazos.ts"));
  return `export const MARCA = ${JSON.stringify({ SIMBOLO, PRINCIPAL, COMPACTA })};\n`;
}

export function servir(puerto = 4173) {
  const servidor = createServer(async (req, res) => {
    try {
      const ruta = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (ruta === "/datos/marca.js") {
        res.writeHead(200, { "content-type": TIPOS[".js"] });
        return res.end(await marca());
      }
      const archivo = normalize(join(raiz, ruta.endsWith("/") ? `${ruta}index.html` : ruta));
      if (!archivo.startsWith(raiz)) throw new Error("fuera");
      const cuerpo = await readFile(archivo);
      res.writeHead(200, { "content-type": TIPOS[extname(archivo)] ?? "application/octet-stream" });
      res.end(cuerpo);
    } catch {
      res.writeHead(404);
      res.end("No encontrado");
    }
  });
  return new Promise((ok) => servidor.listen(puerto, "127.0.0.1", () => ok(servidor)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await servir();
  console.log("Vista previa: http://127.0.0.1:4173/escenas/?t=0");
}
