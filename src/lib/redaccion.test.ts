import { test } from "node:test";
import assert from "node:assert/strict";
import type { Nota } from "./evaluaciones.ts";
import { escalaDescrita, generarRedaccion, LIMITES_REDACCION, MINIMO_NOTAS, origenRedaccion, validarPropuestaGuardada, type NotaRedaccion } from "./redaccion.ts";

// Generador de redacción con una metodología SINTÉTICA con la estructura del
// Método Javier Reyes (escala de cinco niveles con descripciones y criterios
// con descripción). Textos inventados para las pruebas.

const ESCALA = escalaDescrita(
  { 1: "Inicial", 2: "En desarrollo", 3: "Funcional", 4: "Avanzado", 5: "Dominio" },
  [
    { valor: 1, nombre: "Inicial", descripcion: "Necesita ayuda constante en la prueba." },
    { valor: 2, nombre: "En desarrollo", descripcion: "La ejecuta de forma irregular en la prueba." },
    { valor: 3, nombre: "Funcional", descripcion: "La usa bien en situaciones conocidas de prueba." },
    { valor: 4, nombre: "Avanzado", descripcion: "La usa con autonomía en la prueba." },
    { valor: 5, nombre: "Dominio", descripcion: "La usa de forma automática en la prueba." },
  ],
);

const CRITERIOS = [
  ["Técnica", "Estabilidad de ejecución sintética."],
  ["Toma de decisiones", "Elegir bien según la situación sintética."],
  ["Construcción", "Preparar el punto en la prueba."],
  ["Paciencia", "Saber esperar en la prueba."],
  ["Defensa", "Controlar el punto defendiendo en la prueba."],
  ["Ataque", "Generar condiciones antes de acelerar en la prueba."],
  ["Adaptabilidad", "Cambiar de plan en la prueba."],
  ["Gestión del error", "Usar el error como información en la prueba."],
  ["Identidad de juego", "Forma de jugar reconocible en la prueba."],
] as const;

/** Notas en el orden de los criterios (null = sin puntuar). */
function notas(valores: (number | null)[]): NotaRedaccion[] {
  return valores.flatMap((v, i) =>
    v === null ? [] : [{ nombre: CRITERIOS[i][0], grupo: "Criterios", descripcion: CRITERIOS[i][1], orden: i, puntuacion: v as Nota }],
  );
}
const generar = (valores: (number | null)[], extra: { observaciones?: string; objetivo?: string } = {}) =>
  generarRedaccion({ notas: notas(valores), totalCompetencias: CRITERIOS.length, escala: ESCALA, ...extra });

const todo = (r: ReturnType<typeof generar>) => `${r.fortalezas}\n${r.mejoras}\n${r.interpretacion}`;

/** Atribuciones causales que el generador nunca debe hacer por su cuenta. */
const CAUSALES = /precipit|bloque|malas? decisi|falta de|porque|debido a|culpa|nervios|miedo|actitud/i;

test("perfil diferenciado: fortalezas = notas más altas, mejoras = más bajas, con la escala y los criterios reales", () => {
  const r = generar([4, 2, 3, 3, 5, 3, 3, 2, 3]);
  assert.equal(r.perfil, "diferenciado");
  assert.equal(r.provisional, false);
  assert.match(r.fortalezas, /• Defensa \(5 · Dominio\): la usa de forma automática en la prueba\./);
  assert.doesNotMatch(r.fortalezas, /Técnica|Toma de decisiones/); // solo las más altas
  assert.match(r.mejoras, /• Toma de decisiones \(2 · En desarrollo\): la ejecuta de forma irregular en la prueba\. Criterio de la metodología: Elegir bien según la situación sintética\./);
  assert.match(r.mejoras, /• Gestión del error \(2 · En desarrollo\)/);
  assert.doesNotMatch(r.mejoras, /Defensa/);
  assert.match(r.interpretacion, /Valoración de las 9 competencias de la metodología \(media 3,1\)\./);
  assert.match(r.interpretacion, /Perfil muy desigual/);
  assert.doesNotMatch(todo(r), CAUSALES);
});

test("todas altas o todas bajas: sin conclusiones absurdas", () => {
  const altas = generar([5, 5, 5, 5, 5, 5, 5, 5, 5]);
  assert.equal(altas.perfil, "homogeneo");
  assert.match(altas.fortalezas, /Nivel homogéneo y alto/);
  assert.match(altas.mejoras, /No hay competencias por debajo del resto/);
  assert.doesNotMatch(altas.mejoras, /•/); // no se inventan debilidades

  const bajas = generar([1, 1, 1, 1, 1, 1, 1, 1, 1]);
  assert.equal(bajas.fortalezas, "Ninguna competencia destaca por encima del resto en esta evaluación.");
  assert.match(bajas.mejoras, /avanzar hacia el nivel En desarrollo \(2\)/);
  assert.match(bajas.mejoras, /lo fija el objetivo de trabajo/);

  // Casi todas altas: el «aspecto a mejorar» es un 4, y se presenta como margen, no como problema.
  const casi = generar([5, 5, 5, 4, 5, 5, 5, 5, 5]);
  assert.match(casi.mejoras, /• Paciencia \(4 · Avanzado\): margen para avanzar hacia el nivel Dominio\./);
  assert.match(casi.interpretacion, /Perfil bastante equilibrado, con un nivel de diferencia/);
  // Todas bajas con un 2: lo más asentado se presenta con su nivel real.
  const flojas = generar([2, 1, 1, 1, 1, 1, 1, 1, 1]);
  assert.match(flojas.fortalezas, /• Técnica \(2 · En desarrollo\): todavía en nivel En desarrollo, pero es de lo más asentado de su perfil actual\./);
  for (const r of [altas, bajas, casi, flojas]) assert.doesNotMatch(todo(r), CAUSALES);
});

test("puntuaciones incompletas: provisional y sin inventar fortalezas", () => {
  const sin = generar([null, null, null, null, null, null, null, null, null]);
  assert.equal(sin.perfil, "sin-datos");
  assert.equal(sin.fortalezas, "");
  assert.equal(sin.mejoras, "");

  const pocas = generar([5, 1, null, null, null, null, null, null, null]);
  assert.ok(MINIMO_NOTAS > 2);
  assert.equal(pocas.perfil, "insuficiente");
  assert.equal(pocas.provisional, true);
  assert.equal(pocas.fortalezas, "");
  assert.equal(pocas.mejoras, "");
  assert.match(pocas.interpretacion, /Propuesta provisional: solo hay 2 de 9 competencias puntuadas/);
  assert.match(pocas.interpretacion, /Técnica: 5 · Dominio; Toma de decisiones: 1 · Inicial/);

  const parcial = generar([4, 3, 2, null, null, null, null, null, null]);
  assert.equal(parcial.provisional, true);
  assert.equal(parcial.perfil, "diferenciado");
  assert.match(parcial.interpretacion, /Valoración parcial: 3 de 9 competencias puntuadas/);
});

test("reproducible y distinto según el perfil", () => {
  const a = [4, 2, 3, 3, 5, 3, 3, 2, 3];
  assert.deepEqual(generar(a), generar(a));
  const otro = generar([2, 4, 4, 3, 2, 5, 3, 3, 4]);
  assert.notEqual(otro.fortalezas, generar(a).fortalezas);
  assert.notEqual(otro.mejoras, generar(a).mejoras);
  // Las frases de introducción varían entre perfiles (no siempre la misma).
  const intros = new Set(
    [
      [4, 2, 3, 3, 5, 3, 3, 2, 3],
      [2, 4, 4, 3, 2, 5, 3, 3, 4],
      [3, 3, 5, 2, 3, 3, 4, 3, 3],
      [1, 2, 3, 4, 5, 4, 3, 2, 1],
      [5, 4, 4, 4, 3, 4, 4, 4, 4],
      [3, 2, 2, 2, 2, 4, 2, 2, 2],
    ].map((v) => generar(v).fortalezas.split("\n")[0]),
  );
  assert.ok(intros.size >= 2, `introducciones distintas: ${[...intros].join(" | ")}`);
});

test("observaciones del entrenador: contexto citado, sin reescribirlas ni inventar causas", () => {
  const obs = "Hoy en Paciencia ha esperado bien la bola alta. Cansado al final.";
  const r = generar([4, 2, 3, 3, 5, 3, 3, 2, 3], { observaciones: obs });
  assert.match(r.interpretacion, /Las observaciones del entrenador\/a aportan contexto sobre Paciencia; se recogen tal cual en su apartado\./);
  assert.doesNotMatch(todo(r), /Cansado|esperado bien/); // no se parafrasean ni se convierten en diagnóstico
  // Si el entrenador escribe una causa, el generador no la repite como propia.
  const conCausa = generar([4, 2, 3, 3, 5, 3, 3, 2, 3], { observaciones: "Se precipita en la red." });
  assert.doesNotMatch(todo(conCausa), CAUSALES);
  assert.match(conCausa.interpretacion, /completan esta lectura/);
});

test("objetivo del entrenador: se relaciona con los aspectos a mejorar, nunca se genera", () => {
  const sin = generar([4, 2, 3, 3, 5, 3, 3, 2, 3]);
  assert.doesNotMatch(sin.interpretacion, /objetivo/i);
  const alineado = generar([4, 2, 3, 3, 5, 3, 3, 2, 3], { objetivo: "Mejorar la toma de decisiones en transición" });
  assert.match(alineado.interpretacion, /se centra en Toma de decisiones, coherente con los aspectos a mejorar\./);
  const otro = generar([4, 2, 3, 3, 5, 3, 3, 2, 3], { objetivo: "Trabajar el saque" });
  assert.match(otro.interpretacion, /El objetivo de trabajo lo fija el entrenador\/a/);
  assert.doesNotMatch(otro.interpretacion, /saque/); // no se copia ni se reinterpreta
});

test("áreas: compara medias solo si la metodología agrupa en varias áreas con diferencias", () => {
  const n: NotaRedaccion[] = [
    { nombre: "Derecha", grupo: "Técnica", descripcion: null, orden: 0, puntuacion: 4 },
    { nombre: "Revés", grupo: "Técnica", descripcion: null, orden: 1, puntuacion: 5 },
    { nombre: "Pared", grupo: "Defensa", descripcion: null, orden: 2, puntuacion: 2 },
    { nombre: "Globo", grupo: "Defensa", descripcion: null, orden: 3, puntuacion: 2 },
  ];
  const r = generarRedaccion({ notas: n, totalCompetencias: 4, escala: ESCALA });
  assert.match(r.interpretacion, /Por áreas, Técnica \(media 4,5\) queda por encima de Defensa \(media 2,0, cerca del nivel En desarrollo\)\./);
});

test("escala sin descripciones (ÉVORA) y límites de longitud", () => {
  const sinDescripciones = escalaDescrita({ 1: "Inicial", 2: "En desarrollo", 3: "Competente", 4: "Avanzado", 5: "Excelente" });
  const r = generarRedaccion({ notas: notas([5, 1, 3, 3, 3, 3, 3, 3, 3]), totalCompetencias: 9, escala: sinDescripciones });
  assert.match(r.fortalezas, /• Técnica \(5 · Excelente\)\./);
  assert.match(r.mejoras, /• Toma de decisiones \(1 · Inicial\): es la competencia con más recorrido\./);
  // Muchas competencias con descripciones largas: nunca supera los límites de la base de datos.
  const largas: NotaRedaccion[] = Array.from({ length: 30 }, (_, i) => ({
    nombre: `Competencia sintética ${i}`,
    grupo: `Área ${i % 4}`,
    descripcion: "d".repeat(300),
    orden: i,
    puntuacion: ((i % 5) + 1) as Nota,
  }));
  const l = generarRedaccion({ notas: largas, totalCompetencias: 30, escala: ESCALA, observaciones: "x".repeat(3000), objetivo: "o".repeat(200) });
  assert.ok(l.fortalezas.length <= LIMITES_REDACCION.fortalezas);
  assert.ok(l.mejoras.length <= LIMITES_REDACCION.mejoras);
  assert.ok(l.interpretacion.length <= LIMITES_REDACCION.interpretacion);
  assert.match(l.fortalezas, /Y \d+ más en el mismo nivel/);
});

test("propuesta guardada: se valida (llega del navegador) y distingue lo generado de lo editado", () => {
  const r = generar([4, 2, 3, 3, 5, 3, 3, 2, 3]);
  const p = validarPropuestaGuardada({ version: r.version, fortalezas: r.fortalezas, mejoras: r.mejoras, interpretacion: r.interpretacion, provisional: r.provisional });
  assert.ok(p);
  assert.equal(validarPropuestaGuardada(null), null);
  assert.equal(validarPropuestaGuardada({ ...p, fortalezas: 42 }), null);
  assert.equal(validarPropuestaGuardada({ ...p, interpretacion: "x".repeat(2001) }), null);
  assert.equal(validarPropuestaGuardada([p]), null);
  assert.equal(origenRedaccion({ fortalezas: r.fortalezas, mejoras: r.mejoras, interpretacion: r.interpretacion }, p), "propuesta");
  assert.equal(origenRedaccion({ fortalezas: `${r.fortalezas}\nAñadido por el entrenador.`, mejoras: r.mejoras, interpretacion: r.interpretacion }, p), "revisada");
  assert.equal(origenRedaccion({ fortalezas: "Escrito a mano", mejoras: null, interpretacion: null }, null), "manual");
});
