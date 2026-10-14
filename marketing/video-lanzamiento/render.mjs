#!/usr/bin/env node
// Renderiza el vídeo fotograma a fotograma con Chromium (sin pantalla) y lo
// codifica con ffmpeg. Determinista: mismo código → mismo vídeo.
//
//   node render.mjs                  vídeo final + previsualización + portada
//   node render.mjs --rapido         sin desenfoque de movimiento (más rápido)
//   node render.mjs --instantes 1,2.5,12   solo fotogramas sueltos (PNG) para revisar
//
// Requisitos: Node 22, ffmpeg, Chromium (CHROMIUM=/ruta o el de Playwright) y
// la música en salida/musica.wav (npm run musica).

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { cpus } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { servir } from "./servidor.mjs";

const raiz = new URL(".", import.meta.url).pathname;
const salida = join(raiz, "salida");
mkdirSync(salida, { recursive: true });
const args = process.argv.slice(2);
const opcion = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? (args[i + 1] ?? true) : null;
};
const linea = JSON.parse(readFileSync(join(raiz, "linea-temporal.json"), "utf8"));
const FPS = linea.fps;
const TOTAL = Math.round(linea.duracion * FPS);
const SUB = args.includes("--rapido") ? 1 : Number(opcion("--sub") ?? 4); // submuestras por fotograma (obturador 180°)
const TRABAJADORES = Math.max(1, Math.min(Number(opcion("--hilos") ?? 3), cpus().length));
const PUERTO = 4173 + Math.floor(Math.random() * 500);

const CANDIDATOS = [process.env.CHROMIUM, "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].filter(Boolean);
const ejecutable = CANDIDATOS.find((c) => existsSync(c));

const servidor = await servir(PUERTO);
const navegador = await chromium.launch({
  executablePath: ejecutable,
  args: ["--force-color-profile=srgb", "--disable-background-networking", "--disable-component-update", "--no-first-run", "--disable-lcd-text", "--font-render-hinting=none", "--hide-scrollbars"],
});

async function nuevaPagina() {
  const page = await navegador.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const errores = [];
  page.on("pageerror", (e) => errores.push(e));
  page.on("console", (m) => m.type() === "error" && !m.text().startsWith("Failed to load resource") && errores.push(new Error(m.text())));
  page.on("response", (r) => r.status() >= 400 && !r.url().endsWith("/favicon.ico") && errores.push(new Error(`${r.status()} ${r.url()}`)));
  await page.goto(`http://127.0.0.1:${PUERTO}/escenas/?t=0`);
  await page.waitForFunction(() => window.listo === true, null, { timeout: 120000 }).catch((e) => {
    throw errores[0] ?? e;
  });
  if (errores.length) throw errores[0];
  return page;
}

// Captura PNG sin pérdida por CDP (optimizeForSpeed: compresión rápida).
const sesiones = new WeakMap();
async function fotograma(page, t) {
  await page.evaluate((x) => window.dibujar(x), t);
  if (!sesiones.has(page)) sesiones.set(page, await page.context().newCDPSession(page));
  const { data } = await sesiones.get(page).send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true });
  return Buffer.from(data, "base64");
}

// ------------------------------------------------------- instantes sueltos
const instantes = opcion("--instantes");
if (instantes) {
  const dir = join(salida, "instantes");
  mkdirSync(dir, { recursive: true });
  const page = await nuevaPagina();
  for (const t of String(instantes).split(",").map(Number)) {
    await page.evaluate((x) => window.dibujar(x), t);
    await page.screenshot({ path: join(dir, `t-${t.toFixed(2).padStart(5, "0")}.png`) });
    console.log("✓", t);
  }
  await navegador.close();
  servidor.close();
  process.exit(0);
}

// --------------------------------------------------------- solo portada
if (args.includes("--portada")) {
  const page = await nuevaPagina();
  await page.goto(`http://127.0.0.1:${PUERTO}/escenas/?portada`);
  await page.waitForFunction(() => window.listo === true);
  await page.evaluate(() => window.dibujarPortada());
  await page.screenshot({ path: join(salida, "portada-reel.jpg"), type: "jpeg", quality: 95 });
  console.log("✓ salida/portada-reel.jpg");
  await navegador.close();
  servidor.close();
  process.exit(0);
}

// ------------------------------------------------------------ vídeo final
const musica = join(salida, "musica.wav");
if (!existsSync(musica)) {
  console.error("Falta salida/musica.wav. Genera la música antes: npm run musica");
  process.exit(1);
}
const final = join(salida, "evora-padel-lanzamiento.mp4");
const filtros = [
  ...(SUB > 1 ? [`tmix=frames=${SUB}`, `select='not(mod(n+1\\,${SUB}))'`, `setpts=N/${FPS}/TB`] : []),
  // Grano de película fino (solo luminancia, cambia en cada fotograma).
  "noise=c0s=5:c0f=t+u",
  "scale=out_color_matrix=bt709:out_range=tv",
  "format=yuv420p",
].join(",");
const ffmpeg = spawn("ffmpeg", [
  "-y", "-loglevel", "error",
  "-f", "image2pipe", "-c:v", "png", "-framerate", String(FPS * SUB), "-i", "-",
  "-i", musica,
  "-vf", filtros,
  "-r", String(FPS),
  "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-maxrate", "24M", "-bufsize", "48M",
  "-profile:v", "high", "-level:v", "4.2", "-pix_fmt", "yuv420p",
  "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
  "-g", String(FPS), "-bf", "2",
  "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-ac", "2",
  "-shortest", "-movflags", "+faststart",
  final,
], { stdio: ["pipe", "inherit", "inherit"] });
const terminado = new Promise((ok, mal) => ffmpeg.on("close", (c) => (c === 0 ? ok() : mal(new Error(`ffmpeg salió con ${c}`)))));

// Instantes de cada submuestra, centrados en el fotograma (obturador de 180°).
const tiempos = [];
for (let f = 0; f < TOTAL; f++) {
  for (let s = 0; s < SUB; s++) {
    const desfase = SUB > 1 ? ((s + 0.5) / SUB - 0.5) * (0.5 / FPS) : 0;
    tiempos.push(Math.max(0, f / FPS + desfase));
  }
}

console.log(`Renderizando ${TOTAL} fotogramas × ${SUB} submuestras con ${TRABAJADORES} hilos…`);
const paginas = await Promise.all(Array.from({ length: TRABAJADORES }, nuevaPagina));
const listos = new Map();
let siguiente = 0;
const VENTANA = TRABAJADORES * 6; // fotogramas que pueden adelantarse al que toca escribir
let despertar = [];
const inicio = Date.now();

async function escribir(i, buf) {
  listos.set(i, buf);
  while (listos.has(siguiente)) {
    const b = listos.get(siguiente);
    listos.delete(siguiente);
    siguiente++;
    if (!ffmpeg.stdin.write(b)) await new Promise((r) => ffmpeg.stdin.once("drain", r));
    if (siguiente % (FPS * SUB) === 0) {
      const s = (Date.now() - inicio) / 1000;
      process.stdout.write(`\r  ${(siguiente / SUB / FPS).toFixed(0)} s de ${linea.duracion} s · ${s.toFixed(0)} s transcurridos   `);
    }
  }
  // Despierta a TODOS los hilos que esperaban: cada uno vuelve a comprobar su turno.
  const esperan = despertar;
  despertar = [];
  esperan.forEach((r) => r());
}

await Promise.all(
  paginas.map(async (page, w) => {
    for (let i = w; i < tiempos.length; i += TRABAJADORES) {
      // Cada hilo espera según SU posición: el fotograma que toca escribir nunca espera.
      while (i - siguiente >= VENTANA) await new Promise((r) => despertar.push(r));
      await escribir(i, await fotograma(page, tiempos[i]));
    }
  }),
);
ffmpeg.stdin.end();
await terminado;
console.log(`\n✓ ${final} (${(statSync(final).size / 1e6).toFixed(1)} MB) en ${((Date.now() - inicio) / 1000).toFixed(0)} s`);

// Previsualización ligera (540×960, ~3 MB) y portada vertical del Reel.
const ejecutar = (a) =>
  new Promise((ok, mal) => spawn("ffmpeg", ["-y", "-loglevel", "error", ...a], { stdio: "inherit" }).on("close", (c) => (c === 0 ? ok() : mal(new Error(`ffmpeg ${c}`)))));
const vista = join(salida, "evora-padel-lanzamiento-preview.mp4");
await ejecutar(["-i", final, "-vf", "scale=540:960:flags=lanczos", "-c:v", "libx264", "-preset", "slow", "-crf", "28", "-maxrate", "1.2M", "-bufsize", "2.4M", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", vista]);
console.log(`✓ ${vista} (${(statSync(vista).size / 1e6).toFixed(1)} MB)`);

const portadaPage = paginas[0];
await portadaPage.goto(`http://127.0.0.1:${PUERTO}/escenas/?portada`);
await portadaPage.waitForFunction(() => window.listo === true);
await portadaPage.evaluate(() => window.dibujarPortada());
const portada = join(salida, "portada-reel.jpg");
await portadaPage.screenshot({ path: portada, type: "jpeg", quality: 95 });
console.log(`✓ ${portada}`);

await navegador.close();
servidor.close();
