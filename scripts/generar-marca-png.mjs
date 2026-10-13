#!/usr/bin/env node
// PNG de la marca a partir de src/app/icon.svg (generado por generar-marca.mjs),
// renderizados con el Chromium de Playwright (el mismo que usan las pruebas):
//
//   src/app/apple-icon.png          180 × 180, icono al añadir la app a la pantalla de inicio del iPhone
//   public/marca/evora-icono-512.png 512 × 512, icono de app / perfil
//
// Cuadrados a sangre (sin esquinas transparentes): iOS redondea el icono.
// Uso: node scripts/generar-marca-png.mjs

import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const raiz = new URL("..", import.meta.url).pathname;
const svg = readFileSync(join(raiz, "src/app/icon.svg"), "utf8").replace('rx="14"', 'rx="0"');

const navegador = await chromium.launch();
try {
  for (const [ruta, lado] of [
    ["src/app/apple-icon.png", 180],
    ["public/marca/evora-icono-512.png", 512],
  ]) {
    const pagina = await navegador.newPage({ viewport: { width: lado, height: lado } });
    await pagina.setContent(
      `<html><body style="margin:0">${svg.replace("<svg ", `<svg width="${lado}" height="${lado}" `)}</body></html>`,
    );
    await pagina.screenshot({ path: join(raiz, ruta), omitBackground: false });
    await pagina.close();
    console.log(`✓ ${ruta} (${lado} × ${lado})`);
  }
} finally {
  await navegador.close();
}
