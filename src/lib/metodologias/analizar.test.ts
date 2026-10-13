import { test } from "node:test";
import assert from "node:assert/strict";
import { analizarDocumento, enFrase, enTitulo, type PaginaExtraida } from "./analizar.ts";
import type { Linea } from "./lineas.ts";

// Análisis sobre líneas sintéticas (sin PDF): reglas de apartados, tablas,
// escalas y campos, y que no se inventa nada.

type Opc = { tam?: number; negrita?: boolean; x?: number; segs?: [number, string][] };
let y = 2000;
const L = (texto: string, o: Opc = {}): Linea => ({
  y: (y -= 20),
  tam: o.tam ?? 12,
  negrita: o.negrita ?? false,
  segmentos: o.segs ? o.segs.map(([x, t]) => ({ x, texto: t })) : [{ x: o.x ?? 60, texto: texto }],
});
const pagina = (numero: number, lineas: Linea[], fraccionImagen = 0): PaginaExtraida => ({ numero, lineas, fraccionImagen });
// Texto de cuerpo abundante para que el tamaño de cuerpo sea 12.
const relleno = () => L("Texto de cuerpo suficientemente largo para fijar el tamaño normal del documento de prueba.");
const H1 = (t: string) => L(t, { tam: 30 });
const H2 = (t: string) => L(t, { tam: 22 });
const H3 = (t: string) => L(t, { tam: 15 });

test("mayúsculas a texto normal sin cambiar el significado", () => {
  assert.equal(enFrase("TOMA DE DECISIONES"), "Toma de decisiones");
  assert.equal(enFrase("Ya en minúsculas"), "Ya en minúsculas");
  assert.equal(enTitulo("MÉTODO JAVIER REYES"), "Método Javier Reyes");
  assert.equal(enTitulo("ESCUELA DE LA BAHÍA"), "Escuela de la Bahía");
});

test("no se inventan fases, escala ni competencias que no estén en el texto", () => {
  const p = analizarDocumento([pagina(1, [H1("Mi método"), relleno(), relleno()])]);
  assert.deepEqual([p.fases, p.escala, p.competencias, p.fichas], [[], [], [], []]);
  assert.equal(p.nombre, "Mi método");
  assert.ok(p.noInterpretado.some((a) => /versión/.test(a.motivo)));
});

test("escala incompleta y tabla desconocida se señalan en «no interpretado»", () => {
  const p = analizarDocumento([
    pagina(1, [
      H1("Escala"),
      relleno(),
      L("1 • INICIAL", { tam: 15 }),
      L("Empieza."),
      L("2 • MEDIO", { tam: 15 }),
      L("Sigue."),
      H2("Otra tabla"),
      L("", { segs: [[70, "COLOR"], [400, "SABOR"]] }),
      L("", { segs: [[70, "Rojo"], [400, "Dulce"]] }),
    ]),
  ]);
  assert.deepEqual(p.escala.map((n) => [n.valor, n.nombre, n.descripcion]), [[1, "Inicial", "Empieza."], [2, "Medio", "Sigue."]]);
  assert.ok(p.noInterpretado.some((a) => /2 niveles de escala/.test(a.motivo)));
  assert.ok(p.noInterpretado.some((a) => /Tabla sin clasificar/.test(a.motivo) && /Rojo \| Dulce/.test(a.texto)));
});

test("fichas: campos de texto, escala en mayúsculas, opciones, listas y líneas extra", () => {
  const p = analizarDocumento([
    pagina(1, [relleno(), relleno()]),
    pagina(2, [
      H1("FICHA 03 · PERFIL DE JUEGO"),
      L("La ficha es una hipótesis de trabajo."),
      H3("INTENCIÓN OFENSIVA"),
      L("☐ Finaliza ☐ Acelera"),
      L("PACIENCIA: 1 2 3 4 5"),
      H3("CONSTRUCCIÓN"),
      L("☐ Sabe esperar ☐ A veces ☐ No sabe esperar"),
      L("☐ Genera espacios ☐ A veces ☐ No genera espacios"),
      H3("RELACIÓN CON EL ERROR"),
      L("☐ Se precipita ☐ Mantiene plan"),
      L("☐ Se bloquea"),
      H3("DESCRIPCIÓN DEL ENTRENADOR"),
      L("Actualmente considero que este jugador: _____"),
      L("_____"),
      L("_____"),
      H3("FORMA DE GANAR"),
      L("Debería ganar los puntos mediante:"),
      L("_____"),
      H3("FORTALEZAS"),
      L("1: _____"),
      L("2: _____"),
      L("3: _____"),
      L("Algo sin formato reconocible"),
    ]),
  ]);
  const [f] = p.fichas;
  assert.equal(f.numero, 3);
  assert.equal(f.titulo, "Perfil de juego");
  assert.equal(f.descripcion, "La ficha es una hipótesis de trabajo.");
  const resumen = f.secciones.map((s) => [s.titulo, s.campos.map((c) => `${c.tipo}:${c.etiqueta}${c.opciones ? `{${c.opciones.join("/")}}` : ""}${c.elementos ? `×${c.elementos}` : ""}${(c.lineas ?? 1) > 1 ? `(${c.lineas})` : ""}`)]);
  assert.deepEqual(resumen, [
    ["Intención ofensiva", ["opciones:Intención ofensiva{Finaliza/Acelera}", "escala:Paciencia"]],
    ["Construcción", ["opciones:Construcción{Sabe esperar/A veces/No sabe esperar}", "opciones:Construcción (2){Genera espacios/A veces/No genera espacios}"]],
    ["Relación con el error", ["opciones:Relación con el error{Se precipita/Mantiene plan/Se bloquea}"]],
    ["Descripción del entrenador", ["texto:Actualmente considero que este jugador(3)"]],
    ["Forma de ganar", ["texto:Debería ganar los puntos mediante"]],
    ["Fortalezas", ["lista:Fortalezas×3"]],
  ]);
  assert.equal(f.secciones[4].categoria, "identidad");
  assert.ok(p.noInterpretado.some((a) => a.pagina === 2 && a.texto === "Algo sin formato reconocible"));
  // Una ficha que no es de evaluación no genera competencias.
  assert.deepEqual(p.competencias, []);
});

test("categorías de los apartados (plan, sesión) para revisarlos agrupados", () => {
  const p = analizarDocumento([
    pagina(1, [relleno(), relleno()]),
    pagina(2, [
      H1("FICHA 05 · PLAN DE DESARROLLO"),
      H3("OBJETIVOS SECUNDARIOS"),
      L("1: _____"),
      H3("PROGRESIÓN"),
      L("Nivel 1 — Sin oposición: _____"),
      H3("CRITERIO DE ÉXITO"),
      L("Cómo sabremos que lo hace bien: _____"),
      H1("FICHA 06 · SESIÓN"),
      L("Fecha: _____"),
      H3("BLOQUE 1"),
      L("Objetivo: _____"),
    ]),
  ]);
  assert.deepEqual(p.fichas.map((f) => f.secciones.map((s) => [s.titulo, s.categoria])), [
    [["Objetivos secundarios", "objetivos"], ["Progresión", "ejercicios"], ["Criterio de éxito", "exito"]],
    [["General", "sesion"], ["Bloque 1", "sesion"]],
  ]);
});

test("las imágenes grandes se avisan con el título de la página", () => {
  const p = analizarDocumento([pagina(1, [relleno(), relleno()]), pagina(2, [H1("Mapa del método")], 0.5)]);
  const aviso = p.noInterpretado.find((a) => a.pagina === 2);
  assert.ok(aviso && /50 %/.test(aviso.motivo) && aviso.texto === "Mapa del método");
});
