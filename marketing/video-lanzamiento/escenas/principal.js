// Punto de entrada: monta el ambiente y las siete escenas y expone
// window.dibujar(t) para el renderizador (render.mjs).
//
// Vista previa en el navegador: /escenas/?t=12.5 (un instante) o /escenas/?play

import { crearAmbiente } from "./ambiente.js";
import { el, imagenesListas } from "./motor.js";
import { escenaMarca } from "./escenas/1-marca.js";
import { escenaProblema } from "./escenas/2-problema.js";
import { escenaConectado } from "./escenas/3-conectado.js";
import { escenaEvaluacion } from "./escenas/4-evaluacion.js";
import { escenaInformes } from "./escenas/5-informes.js";
import { escenaMetodologia } from "./escenas/6-metodologia.js";
import { escenaCierre } from "./escenas/7-cierre.js";
import { crearPortada } from "./portada.js";

const [linea, capturas] = await Promise.all([
  fetch("../linea-temporal.json").then((r) => r.json()),
  fetch("../publico/capturas/capturas.json").then((r) => r.json()),
]);

const lienzo = document.getElementById("lienzo");
const escenasRaiz = el("div", "capa");
const actualizarAmbiente = crearAmbiente(lienzo, escenasRaiz);
const ctx = { linea, capturas, ev: linea.eventos };
const escenas = [escenaMarca, escenaProblema, escenaConectado, escenaEvaluacion, escenaInformes, escenaMetodologia, escenaCierre].map((crear) => {
  const e = crear(ctx);
  escenasRaiz.append(e.raiz);
  return e;
});

const portada = crearPortada(capturas);
lienzo.insertBefore(portada.raiz, escenasRaiz.nextSibling);

await document.fonts.ready;
await Promise.all(["800 italic 40px 'Barlow Condensed'", "700 italic 40px 'Barlow Condensed'", "600 40px Inter", "400 40px Inter", "700 40px Caveat"].map((f) => document.fonts.load(f)));
await imagenesListas();

window.duracion = linea.duracion;
window.dibujar = (t) => {
  actualizarAmbiente(t);
  for (const e of escenas) {
    const activa = t >= e.desde && t <= e.hasta;
    // Las escenas inactivas no se pintan (display: none).
    e.raiz.style.visibility = activa ? "visible" : "hidden";
    e.raiz.style.display = activa ? "block" : "none";
    if (activa) e.actualizar(t);
  }
};
// Portada del Reel: el ambiente del cierre, sin escenas, con su composición.
window.dibujarPortada = () => {
  actualizarAmbiente(25);
  for (const e of escenas) e.raiz.style.display = "none";
  portada.dibujar();
};
window.listo = true;

const parametros = new URLSearchParams(location.search);
if (parametros.has("play")) {
  const inicio = performance.now() - Number(parametros.get("desde") ?? 0) * 1000;
  const bucle = () => {
    window.dibujar(((performance.now() - inicio) / 1000) % linea.duracion);
    requestAnimationFrame(bucle);
  };
  bucle();
} else if (parametros.has("portada")) {
  window.dibujarPortada();
} else {
  window.dibujar(Number(parametros.get("t") ?? 0));
}
