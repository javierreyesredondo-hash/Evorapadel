import { test } from "node:test";
import assert from "node:assert/strict";
import { construirLineas, textoLinea, type FragmentoTexto } from "./lineas.ts";

// Fragmentos como los que devuelve pdf.js (patrones reales de un PDF de
// metodología: bloques que empiezan con un fragmento vacío, celdas separadas
// por espacios anchos y textos partidos en varias líneas).

const f = (texto: string, x: number, y: number, extra: Partial<FragmentoTexto> = {}): FragmentoTexto => ({
  texto,
  x,
  y,
  ancho: texto.length * 7,
  tam: 13.5,
  negrita: false,
  finDeLinea: false,
  ...extra,
});
const bloque = (x: number, y: number) => f("", x, y, { ancho: 0, finDeLinea: true });
const hueco = (x: number, y: number, ancho: number) => f(" ", x, y, { ancho });

test("una fila de tabla: celdas separadas y la celda partida sigue en su columna", () => {
  const lineas = construirLineas([
    bloque(80, 322),
    f("01", 80, 322),
    hueco(94, 322, 322),
    f("Conocer al jugador", 336, 322),
    hueco(461, 322, 174),
    f("La clase se adapta al jugador, no al", 591, 322, { finDeLinea: true }),
    f("revés.", 591, 300),
  ]);
  assert.equal(lineas.length, 1);
  assert.deepEqual(lineas[0].segmentos.map((s) => [s.x, s.texto]), [
    [80, "01"],
    [336, "Conocer al jugador"],
    [591, "La clase se adapta al jugador, no al revés."],
  ]);
});

test("un párrafo partido en varias líneas es una sola línea lógica", () => {
  const [l] = construirLineas([
    bloque(65, 302),
    f("Entender al jugador. Construir su", 65, 302, { tam: 46.6, finDeLinea: true }),
    f("juego.", 65, 245, { tam: 46.6 }),
  ]);
  assert.equal(textoLinea(l), "Entender al jugador. Construir su juego.");
});

test("«Agresividad: 1 2» + «3 4 5» se unen; campos de bloques distintos no", () => {
  const lineas = construirLineas([
    f("Iniciativa: 1 2 3 4 5", 467, 377),
    hueco(584, 377, 17),
    f("Agresividad: 1 2", 727, 377, { finDeLinea: true }),
    f("3 4 5", 467, 355),
    bloque(65, 290),
    f("1: _____", 65, 290),
    bloque(65, 256),
    f("2: _____", 65, 256),
  ]);
  assert.deepEqual(lineas.map(textoLinea), ["Iniciativa: 1 2 3 4 5 Agresividad: 1 2 3 4 5", "1: _____", "2: _____"]);
});

test("una casilla al final de línea continúa en la siguiente", () => {
  const [l] = construirLineas([
    f("☐ Finaliza", 65, 514),
    hueco(140, 514, 13),
    f("☐", 395, 514, { finDeLinea: true }),
    f("Construye antes de atacar", 65, 492),
  ]);
  assert.equal(textoLinea(l), "☐ Finaliza ☐ Construye antes de atacar");
});

test("tras un campo («_____» o «:») no se une la línea siguiente aunque haya salto", () => {
  const lineas = construirLineas([
    f("Nombre: _____", 65, 400, { finDeLinea: true }),
    f("Edad: _____", 65, 380, { finDeLinea: true }),
    f("Este jugador debería ganar mediante:", 65, 360, { finDeLinea: true }),
    f("_____", 65, 340),
  ]);
  assert.deepEqual(lineas.map(textoLinea), ["Nombre: _____", "Edad: _____", "Este jugador debería ganar mediante:", "_____"]);
});

test("conserva el tamaño y la negrita de la línea", () => {
  const [a, b] = construirLineas([
    f("Regla de oro", 109, 115, { negrita: true }),
    bloque(109, 81),
    f("Texto normal", 109, 81),
  ]);
  assert.equal(a.negrita, true);
  assert.equal(b.negrita, false);
  assert.equal(a.tam, 13.5);
});
