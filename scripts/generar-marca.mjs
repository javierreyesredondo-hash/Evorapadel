#!/usr/bin/env node
// Genera la marca de ÉVORA PADEL (SVG limpios, sin fuentes externas):
//
//   public/marca/evora-padel.svg            principal (símbolo + ÉVORA PADEL), fondo oscuro
//   public/marca/evora-padel-compacto.svg   compacta para móvil (símbolo + ÉVORA / PADEL)
//   public/marca/evora-simbolo.svg          símbolo solo, fondo transparente
//   src/app/icon.svg                        favicon (símbolo sobre azul noche)
//   src/components/marca/trazos.ts          los mismos trazos para el componente <Logo>
//
// El texto se convierte en trazos con la fuente de la marca (Barlow, SIL OFL
// 1.1, @fontsource) mediante @pdf-lib/fontkit: el logo se ve igual en cualquier
// dispositivo y escala sin pérdida. Los PNG (icono de iPhone y de 512 px) los
// genera scripts/generar-marca-png.mjs a partir de estos SVG.
//
// Uso: node scripts/generar-marca.mjs

import fontkit from "@pdf-lib/fontkit";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const raiz = new URL("..", import.meta.url).pathname;
const COLOR = { noche: "#101B2C", lima: "#C7FF32", blanco: "#FFFFFF" };

const fuente = (archivo) =>
  fontkit.create(readFileSync(join(raiz, "node_modules/@fontsource/barlow/files", archivo)));
const BARLOW_800 = fuente("barlow-latin-800-italic.woff");
const BARLOW_700 = fuente("barlow-latin-700-italic.woff");

const r = (n) => Math.round(n * 100) / 100;

/**
 * Texto → trazo SVG. (x, base) es el inicio de la línea base; `alto` es la
 * altura de mayúsculas en unidades del SVG; `espaciado` en fracción de em.
 */
function texto(font, cadena, x, base, alto, espaciado = 0) {
  const escala = alto / font.capHeight;
  const run = font.layout(cadena);
  let cursor = x;
  const partes = [];
  run.glyphs.forEach((glifo, i) => {
    const px = (vx) => r(cursor + vx * escala);
    const py = (vy) => r(base - vy * escala);
    for (const { command, args } of glifo.path.commands) {
      if (command === "moveTo") partes.push(`M${px(args[0])} ${py(args[1])}`);
      else if (command === "lineTo") partes.push(`L${px(args[0])} ${py(args[1])}`);
      else if (command === "quadraticCurveTo") partes.push(`Q${px(args[0])} ${py(args[1])} ${px(args[2])} ${py(args[3])}`);
      else if (command === "bezierCurveTo")
        partes.push(`C${px(args[0])} ${py(args[1])} ${px(args[2])} ${py(args[3])} ${px(args[4])} ${py(args[5])}`);
      else if (command === "closePath") partes.push("Z");
    }
    cursor += run.positions[i].xAdvance * escala + (i < run.glyphs.length - 1 ? espaciado * alto : 0);
  });
  return { d: partes.join(""), ancho: cursor - x };
}

// --------------------------------------------------------------- símbolo
// Una «É» geométrica en cursiva: el asta y tres brazos que CRECEN de abajo
// arriba (medir, progresar: «Haz crecer») y, como acento, la bola lima
// («Observa»; el pádel). Diseñado en una cuadrícula de 64 × 64.
const INCLINACION = Math.tan((10 * Math.PI) / 180);
const inclinar = (x, y, ejeY) => r(x + (ejeY - y) * INCLINACION);

/** Paralelogramo inclinado: rectángulo (x, y, ancho, alto) con la inclinación de la marca. */
function barra(x, y, ancho, alto, ejeY) {
  const p = [
    [x, y],
    [x + ancho, y],
    [x + ancho, y + alto],
    [x, y + alto],
  ].map(([px, py]) => `${inclinar(px, py, ejeY)} ${r(py)}`);
  return `M${p[0]}L${p[1]}L${p[2]}L${p[3]}Z`;
}

function simbolo() {
  const eje = 52; // la base no se desplaza al inclinar
  const asta = barra(12, 16, 8, 36, eje);
  const brazos = [
    barra(12, 16, 36, 7, eje), // arriba: el más largo
    barra(12, 30.5, 27, 7, eje),
    barra(12, 45, 18, 7, eje), // abajo: el más corto
  ];
  return {
    letra: [asta, ...brazos].join(""),
    bola: { cx: 52, cy: 8.5, r: 5.5 },
  };
}

const S = simbolo();
const svgSimbolo = (dx = 0, dy = 0, escala = 1, colorLetra = COLOR.blanco) =>
  `<g transform="translate(${dx} ${dy}) scale(${escala})">` +
  `<path fill="${colorLetra}" d="${S.letra}"/>` +
  `<circle fill="${COLOR.lima}" cx="${S.bola.cx}" cy="${S.bola.cy}" r="${S.bola.r}"/></g>`;

// ------------------------------------------------------------- variantes
const cabecera = (ancho, alto, titulo) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r(ancho)} ${alto}" role="img" aria-label="${titulo}">` +
  `<title>${titulo}</title>`;

// Principal: símbolo + ÉVORA (blanco) + PADEL (lima, espaciado), en una línea.
const ALTO_P = 64;
const evoraP = texto(BARLOW_800, "ÉVORA", 68, 52, 36);
const padelP = texto(BARLOW_700, "PADEL", 68 + evoraP.ancho + 12, 52, 17, 0.32);
const anchoP = 68 + evoraP.ancho + 12 + padelP.ancho + 4;
const principal =
  cabecera(anchoP, ALTO_P, "ÉVORA PADEL") +
  svgSimbolo() +
  `<path fill="${COLOR.blanco}" d="${evoraP.d}"/>` +
  `<path fill="${COLOR.lima}" d="${padelP.d}"/></svg>`;

// Compacta: símbolo + ÉVORA sobre PADEL (más estrecha, para la cabecera móvil).
const evoraC = texto(BARLOW_800, "ÉVORA", 68, 37, 21);
const padelC = texto(BARLOW_700, "PADEL", 69, 52, 12, 0.36);
const anchoC = 68 + Math.max(evoraC.ancho, padelC.ancho) + 4;
const compacta =
  cabecera(anchoC, 64, "ÉVORA PADEL") +
  svgSimbolo() +
  `<path fill="${COLOR.blanco}" d="${evoraC.d}"/>` +
  `<path fill="${COLOR.lima}" d="${padelC.d}"/></svg>`;

// Símbolo solo (transparente) y favicon / icono de app (sobre azul noche).
const simboloSolo = cabecera(64, 64, "ÉVORA PADEL") + svgSimbolo() + "</svg>";
const icono =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
  `<rect width="64" height="64" rx="14" fill="${COLOR.noche}"/>` +
  svgSimbolo(4.5, 8.5, 0.8) +
  "</svg>";

mkdirSync(join(raiz, "public/marca"), { recursive: true });
mkdirSync(join(raiz, "src/components/marca"), { recursive: true });
const escribir = (ruta, contenido) => {
  writeFileSync(join(raiz, ruta), `${contenido}\n`);
  console.log(`✓ ${ruta}`);
};
escribir("public/marca/evora-padel.svg", principal);
escribir("public/marca/evora-padel-compacto.svg", compacta);
escribir("public/marca/evora-simbolo.svg", simboloSolo);
escribir("src/app/icon.svg", icono);
escribir(
  "src/components/marca/trazos.ts",
  `// GENERADO por scripts/generar-marca.mjs: no editar a mano.\n\n` +
    `export const SIMBOLO = ${JSON.stringify({ letra: S.letra, bola: S.bola })};\n\n` +
    `export const PRINCIPAL = ${JSON.stringify({ ancho: r(anchoP), alto: ALTO_P, evora: evoraP.d, padel: padelP.d })};\n\n` +
    `export const COMPACTA = ${JSON.stringify({ ancho: r(anchoC), alto: 64, evora: evoraC.d, padel: padelC.d })};`,
);
