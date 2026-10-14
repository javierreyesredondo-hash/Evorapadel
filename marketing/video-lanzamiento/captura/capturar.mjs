#!/usr/bin/env node
// Capturas REALES de ÉVORA PADEL para el vídeo: pantallas de la app de verdad
// con la escuela ficticia de sembrar-demo.mjs. Solo contra el servidor LOCAL.
//
//   node captura/capturar.mjs [http://127.0.0.1:3100]
//
// Por cada pantalla se guardan (móvil 390×844 a 3×, 1170 px de ancho):
//   <nombre>.webp          lo que se ve en el móvil al abrirla;
//   <nombre>-contenido.webp la página entera SIN la cabecera ni la barra
//                          inferior (fijas), para poder desplazarla en el vídeo;
//   <nombre>-arriba.webp / -abajo.webp  esas barras fijas, que se superponen.
// y capturas.json con las medidas (px CSS) que usa el vídeo.

import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://127.0.0.1:3100";
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(BASE)) throw new Error("Solo el servidor local.");
const raiz = new URL("../../../", import.meta.url).pathname;
const salida = new URL("../publico/capturas/", import.meta.url).pathname;
const tmp = join(salida, ".png");
rmSync(salida, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });

const env = Object.fromEntries(
  readFileSync(join(raiz, ".env.e2e.local"), "utf8").split("\n").map((l) => /^([A-Z0-9_]+)=(.*)$/.exec(l.trim())).filter(Boolean).map((m) => [m[1], m[2]]),
);
const psql = (sql) =>
  execFileSync("docker", ["exec", "-i", "evora-db", "psql", "-U", "postgres", "-d", "postgres", "-XAt", "-c", sql], { encoding: "utf8" }).trim();

const ALTO = 844;
const medidas = {};
const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });

async function sesion(email) {
  const contexto = await navegador.newContext({ viewport: { width: 390, height: ALTO }, deviceScaleFactor: 3, locale: "es-ES", colorScheme: "dark" });
  const page = await contexto.newPage();
  await page.goto(`${BASE}/acceso`);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(env.E2E_CONTRASENA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/acceso"));
  return page;
}

async function listo(page) {
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => !document.querySelector('div[hidden][id^="S:"]'));
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : null));
  await page.waitForTimeout(300);
}

/** Barras fijas: cabecera (arriba) y navegación / barra de guardar (abajo). */
async function barras(page) {
  return page.evaluate((alto) => {
    let arriba = 0;
    let abajo = alto;
    const fijas = [];
    for (const el of document.querySelectorAll("body *")) {
      const pos = getComputedStyle(el).position;
      if (pos !== "fixed" && pos !== "sticky") continue;
      const r = el.getBoundingClientRect();
      if (r.height === 0 || r.width === 0 || getComputedStyle(el).display === "none") continue;
      fijas.push(el);
      if (r.top <= 1) arriba = Math.max(arriba, r.bottom);
      else abajo = Math.min(abajo, r.top);
    }
    fijas.forEach((el, i) => el.setAttribute("data-fija", String(i)));
    return { arriba: Math.round(arriba), abajo: Math.round(alto - abajo) };
  }, ALTO);
}

async function captura(page, nombre, { soloContenido = false } = {}) {
  await listo(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  const b = await barras(page);
  if (!soloContenido) await page.screenshot({ path: join(tmp, `${nombre}.png`) });
  // Barras fijas solas (sin el contenido que queda detrás): se superponen en el vídeo.
  const soloBarras = await page.addStyleTag({ content: "body *{visibility:hidden !important}[data-fija],[data-fija] *{visibility:visible !important}" });
  if (b.abajo > 0) await page.screenshot({ path: join(tmp, `${nombre}-abajo.png`), clip: { x: 0, y: ALTO - b.abajo, width: 390, height: b.abajo } });
  if (!soloContenido && b.arriba > 0) await page.screenshot({ path: join(tmp, `${nombre}-arriba.png`), clip: { x: 0, y: 0, width: 390, height: b.arriba } });
  await soloBarras.evaluate((s) => s.remove());
  const sinBarras = await page.addStyleTag({ content: "[data-fija]{visibility:hidden !important}" });
  await page.screenshot({ path: join(tmp, `${nombre}-contenido.png`), fullPage: true });
  const alto = await page.evaluate(() => document.documentElement.scrollHeight);
  await sinBarras.evaluate((s) => s.remove());
  medidas[nombre] = { ...b, alto };
  console.log("✓", nombre, medidas[nombre]);
}

// ----------------------------------------------------------------- director
const page = await sesion("demo-director@evora.invalid");
const escuela = psql(`select id from public.escuelas where nombre = 'Altamar Pádel Club'`);
const lucia = psql(`select id from public.jugadores where escuela_id = '${escuela}' and nombre = 'Lucía Martín'`);
const grupo = psql(`select id from public.grupos where escuela_id = '${escuela}' and nombre = 'Competición Sub-16'`);
const ultima = psql(`select id from public.evaluaciones where jugador_id = '${lucia}' order by fecha desc limit 1`);

for (const [nombre, ruta] of [
  ["inicio", "/"],
  ["jugadores", "/jugadores"],
  ["jugador", `/jugadores/${lucia}`],
  ["grupos", "/grupos"],
  ["evaluaciones", "/evaluaciones"],
  ["evaluacion", `/evaluaciones/${ultima}`],
  ["informe", `/evaluaciones/${ultima}/informe`],
  ["metodologia", "/metodologia"],
  ["entrenamiento", "/entrenamiento"],
]) {
  await page.goto(`${BASE}${ruta}`);
  await captura(page, nombre);
}

// Evaluación en cadena: un estado por cada nota puesta (sin guardar nada).
await page.goto(`${BASE}/entrenamiento/evaluar/${grupo}`);
await page.getByRole("radio").first().waitFor();
await listo(page);
await page.waitForTimeout(1500); // hidratación
await captura(page, "cadena-0");
const notas = [["Golpes de fondo", 4], ["Juego en la red", 4], ["Juego aéreo", 3], ["Lectura táctica", 5], ["Condición física", 4], ["Fortaleza mental", 4]];
for (const [i, [competencia, n]] of notas.entries()) {
  await page.getByRole("radio", { name: new RegExp(`^${competencia}: ${n} `) }).check();
  await page.waitForTimeout(250);
  await captura(page, `cadena-${i + 1}`, { soloContenido: true });
}
// Posición de cada tarjeta de competencia y de la propuesta automática (px CSS).
medidas.cadenaZonas = await page.evaluate((nombres) => {
  const y = (el) => Math.round(el.getBoundingClientRect().top + window.scrollY);
  const tarjetas = nombres.map((n) => {
    const radio = document.querySelector(`input[aria-label^="${n}: 1 "]`);
    let el = radio;
    while (el && !(el.getBoundingClientRect().height > 120)) el = el.parentElement;
    const r = el.getBoundingClientRect();
    return { nombre: n, y: y(el), alto: Math.round(r.height) };
  });
  const etiqueta = (t) => [...document.querySelectorAll("label, span, p, h2, h3")].find((e) => e.textContent?.trim().startsWith(t));
  return {
    tarjetas,
    fortalezas: y(etiqueta("Fortalezas")),
    mejoras: y(etiqueta("Aspectos a mejorar")),
    interpretacion: y(etiqueta("Interpretación técnica")),
  };
}, notas.map(([n]) => n));

// PDF real del informe (el que se comparte con la familia).
const respuesta = await page.request.get(`${BASE}/evaluaciones/${ultima}/pdf`);
if (!respuesta.ok()) throw new Error(`PDF: ${respuesta.status()}`);
writeFileSync(join(tmp, "informe.pdf"), await respuesta.body());
execFileSync("pdftoppm", ["-png", "-r", "200", join(tmp, "informe.pdf"), join(tmp, "informe-pdf")]);
console.log("✓ informe.pdf");

// -------------------------------------------- propietario (panel de escuelas)
const propietario = await sesion(env.E2E_EMAIL_ADMIN);
await propietario.goto(`${BASE}/admin`);
await captura(propietario, "admin");

await navegador.close();

// WebP (más ligero para el repositorio; calidad alta, el texto se lee nítido).
execFileSync("python3", [
  "-c",
  `import glob, os
from PIL import Image
for f in glob.glob(${JSON.stringify(tmp)} + "/*.png"):
    Image.open(f).convert("RGB").save(os.path.join(${JSON.stringify(salida)}, os.path.basename(f)[:-4] + ".webp"), quality=94, method=6)`,
]);
writeFileSync(join(salida, "capturas.json"), JSON.stringify(medidas, null, 2) + "\n");
rmSync(tmp, { recursive: true, force: true });
console.log("Listo:", salida);
