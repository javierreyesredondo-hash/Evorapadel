// Lógica pura de la demo (sin React ni navegador) para poder probarla
// con `node --test`. Las importaciones relativas llevan extensión .ts por
// ese mismo motivo.

import {
  AREAS,
  CRITERIOS,
  evaluacionesIniciales,
  jugadores as jugadoresDemo,
  objetivosIniciales,
  pendientesIniciales,
  TIPOS_EVALUACION,
  type Area,
  type CriterioId,
  type EvaluacionPendiente,
  type EvaluacionRealizada,
  type Jugador,
  type Nivel,
  type Nota,
  type Objetivo,
  type Posicion,
} from "./demo-data.ts";

// ---------------------------------------------------------------- Estado

export type Estado = {
  pendientes: EvaluacionPendiente[];
  evaluaciones: EvaluacionRealizada[];
  objetivos: Objetivo[];
};

export function estadoInicial(): Estado {
  return {
    pendientes: structuredClone(pendientesIniciales),
    evaluaciones: structuredClone(evaluacionesIniciales),
    objetivos: structuredClone(objetivosIniciales),
  };
}

export type Accion =
  | { tipo: "registrarEvaluacion"; evaluacion: EvaluacionRealizada; pendienteId?: string }
  | { tipo: "crearObjetivo"; objetivo: Objetivo }
  | { tipo: "actualizarProgreso"; objetivoId: string; progreso: number }
  | { tipo: "restablecer" };

export function reducir(estado: Estado, accion: Accion): Estado {
  switch (accion.tipo) {
    case "registrarEvaluacion":
      return {
        ...estado,
        evaluaciones: [...estado.evaluaciones, accion.evaluacion],
        pendientes: accion.pendienteId
          ? estado.pendientes.filter((p) => p.id !== accion.pendienteId)
          : estado.pendientes,
      };
    case "crearObjetivo":
      return { ...estado, objetivos: [...estado.objetivos, accion.objetivo] };
    case "actualizarProgreso":
      return {
        ...estado,
        objetivos: estado.objetivos.map((o) =>
          o.id === accion.objetivoId
            ? { ...o, progreso: limitarProgreso(accion.progreso, o.meta) }
            : o,
        ),
      };
    case "restablecer":
      return estadoInicial();
  }
}

// ------------------------------------------------------------- Jugadores

export type Filtros = {
  texto: string;
  nivel: Nivel | null;
  posicion: Posicion | null;
};

export const FILTROS_VACIOS: Filtros = { texto: "", nivel: null, posicion: null };

/** Minúsculas y sin tildes: "Lucía" → "lucia". */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** Busca por nombre, grupo o foco (sin distinguir tildes ni mayúsculas) y filtra por nivel y posición. */
export function filtrarJugadores(lista: readonly Jugador[], filtros: Filtros): Jugador[] {
  const palabras = normalizar(filtros.texto).split(/\s+/).filter(Boolean);
  return lista.filter((j) => {
    if (filtros.nivel && j.nivel !== filtros.nivel) return false;
    if (filtros.posicion && j.posicion !== filtros.posicion) return false;
    const pajar = normalizar(`${j.nombre} ${j.grupo} ${j.foco}`);
    return palabras.every((p) => pajar.includes(p));
  });
}

// ---------------------------------------------------------- Evaluaciones

// Escala de puntuación ------------------------------------------------
//
// Cada criterio se puntúa con una nota entera de 1 a 5. La puntuación global
// de una evaluación es la media EXACTA de sus notas multiplicada por 20 y
// redondeada al entero más cercano:
//
//   puntuación = round(media × 20)      nota 1 → 20 · 2 → 40 · 3 → 60 · 4 → 80 · 5 → 100
//
// Por tanto el rango es 20–100 (no 0–100): no existe nota 0.
// La media se muestra con un decimal solo como texto; la puntuación se calcula
// con la media sin redondear. Ej.: notas 4,3,3,4,5,4 → media 3,833… (se
// muestra «3,8») → 76,67 → 77. Con 6 criterios el resultado nunca cae en ,5,
// así que no hay empates de redondeo.

/** Puntos por cada unidad de nota: 1 → 20, 5 → 100. */
export const PUNTOS_POR_NOTA = 20;
export const RANGO_PUNTUACION = { min: 1 * PUNTOS_POR_NOTA, max: 5 * PUNTOS_POR_NOTA } as const;

function sumaNotas(notas: Partial<Record<CriterioId, Nota>>): { suma: number; cuantas: number } {
  let suma = 0;
  let cuantas = 0;
  for (const c of CRITERIOS) {
    const nota = notas[c.id];
    if (esNota(nota)) {
      suma += nota;
      cuantas += 1;
    }
  }
  return { suma, cuantas };
}

/**
 * Media exacta (sin redondear) de las notas puntuadas; null si no hay ninguna.
 * Acepta evaluaciones a medio rellenar para mostrar la media en el formulario.
 */
export function mediaNotas(notas: Partial<Record<CriterioId, Nota>>): number | null {
  const { suma, cuantas } = sumaNotas(notas);
  return cuantas === 0 ? null : suma / cuantas;
}

/** Puntuación global (20–100) de una evaluación completa: round(media exacta × 20). */
export function puntuacionGlobal(notas: Record<CriterioId, Nota>): number {
  const { suma, cuantas } = sumaNotas(notas);
  // Aritmética entera para no depender del redondeo de coma flotante.
  return Math.round((suma * PUNTOS_POR_NOTA) / cuantas);
}

/** Evaluaciones de un jugador, de la más reciente a la más antigua. */
export function evaluacionesDe(estado: Estado, jugadorId: string): EvaluacionRealizada[] {
  return estado.evaluaciones
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.jugadorId === jugadorId)
    // Misma fecha: la registrada después va primero.
    .sort((a, b) => b.e.fecha.localeCompare(a.e.fecha) || b.i - a.i)
    .map(({ e }) => e);
}

export type Resumen = {
  puntuacion: number | null;
  tendencia: number | null;
  ultima: EvaluacionRealizada | null;
  total: number;
};

export function resumenJugador(estado: Estado, jugadorId: string): Resumen {
  const [ultima, anterior] = evaluacionesDe(estado, jugadorId);
  const puntuacion = ultima ? puntuacionGlobal(ultima.notas) : null;
  return {
    puntuacion,
    tendencia: ultima && anterior ? puntuacion! - puntuacionGlobal(anterior.notas) : null,
    ultima: ultima ?? null,
    total: estado.evaluaciones.filter((e) => e.jugadorId === jugadorId).length,
  };
}

export type EntradaEvaluacion = {
  jugadorId: string;
  tipo: string;
  notas: Partial<Record<string, unknown>>;
  comentario: string;
};

export type Resultado<T> =
  | { ok: true; valor: T }
  | { ok: false; errores: Record<string, string> };

export const MAX_COMENTARIO = 500;

export function esTipoEvaluacion(valor: unknown): valor is (typeof TIPOS_EVALUACION)[number] {
  return typeof valor === "string" && (TIPOS_EVALUACION as readonly string[]).includes(valor);
}

export function esNota(valor: unknown): valor is Nota {
  return Number.isInteger(valor) && (valor as number) >= 1 && (valor as number) <= 5;
}

/** Valida una evaluación: jugador existente, tipo, y cada criterio con un entero de 1 a 5. */
export function validarEvaluacion(
  entrada: EntradaEvaluacion,
  datos: { id: string; fecha: string; jugadores?: readonly Jugador[] },
): Resultado<EvaluacionRealizada> {
  const errores: Record<string, string> = {};
  const lista = datos.jugadores ?? jugadoresDemo;

  if (!lista.some((j) => j.id === entrada.jugadorId)) {
    errores.jugadorId = "Elige un jugador.";
  }
  if (!esTipoEvaluacion(entrada.tipo.trim())) {
    errores.tipo = "Elige el tipo de evaluación.";
  }
  for (const c of CRITERIOS) {
    if (!esNota(entrada.notas[c.id])) {
      errores[c.id] = "Puntúa de 1 a 5.";
    }
  }
  const comentario = entrada.comentario.trim();
  if (comentario.length > MAX_COMENTARIO) {
    errores.comentario = `Máximo ${MAX_COMENTARIO} caracteres.`;
  }

  if (Object.keys(errores).length > 0) return { ok: false, errores };

  const notas = Object.fromEntries(
    CRITERIOS.map((c) => [c.id, entrada.notas[c.id] as Nota]),
  ) as Record<CriterioId, Nota>;

  return {
    ok: true,
    valor: {
      id: datos.id,
      jugadorId: entrada.jugadorId,
      tipo: entrada.tipo.trim(),
      fecha: datos.fecha,
      notas,
      comentario,
    },
  };
}

// ------------------------------------------------------------- Objetivos

export const MAX_META = 1000;
export const LARGO_TITULO = { min: 3, max: 80 };

/** Título limpio: sin espacios al principio/final ni repetidos. */
export function normalizarTitulo(titulo: string): string {
  return titulo.trim().replace(/\s+/g, " ");
}

export function limitarProgreso(progreso: number, meta: number): number {
  return Math.min(meta, Math.max(0, Math.round(progreso)));
}

export function objetivoCompletado(o: Objetivo): boolean {
  return o.progreso >= o.meta;
}

export type EntradaObjetivo = {
  jugadorId: string;
  titulo: string;
  area: string;
  /** Texto tal y como llega del formulario. */
  meta: string;
  progreso: string;
};

/** Convierte "12" en 12; cualquier cosa que no sea un entero (vacío, "2,5", "1e3") da null. */
export function enteroDeTexto(texto: string): number | null {
  const limpio = texto.trim();
  return /^\d+$/.test(limpio) ? Number(limpio) : null;
}

export function validarObjetivo(
  entrada: EntradaObjetivo,
  datos: { id: string; jugadores?: readonly Jugador[] },
): Resultado<Objetivo> {
  const errores: Record<string, string> = {};
  const lista = datos.jugadores ?? jugadoresDemo;

  if (!lista.some((j) => j.id === entrada.jugadorId)) {
    errores.jugadorId = "Elige un jugador.";
  }
  const titulo = normalizarTitulo(entrada.titulo);
  if (titulo.length < LARGO_TITULO.min || titulo.length > LARGO_TITULO.max) {
    errores.titulo = `Escribe entre ${LARGO_TITULO.min} y ${LARGO_TITULO.max} caracteres.`;
  }
  if (!(AREAS as readonly string[]).includes(entrada.area)) {
    errores.area = "Elige un área.";
  }
  const meta = enteroDeTexto(entrada.meta);
  if (meta === null || meta < 1 || meta > MAX_META) {
    errores.meta = `La meta debe ser un número entero entre 1 y ${MAX_META}.`;
  }
  const progreso = entrada.progreso.trim() === "" ? 0 : enteroDeTexto(entrada.progreso);
  if (progreso === null) {
    errores.progreso = "El progreso debe ser un número entero.";
  } else if (meta !== null && !errores.meta && progreso > meta) {
    errores.progreso = "El progreso no puede superar la meta.";
  }

  if (Object.keys(errores).length > 0) return { ok: false, errores };

  return {
    ok: true,
    valor: {
      id: datos.id,
      jugadorId: entrada.jugadorId,
      titulo,
      area: entrada.area as Area,
      meta: meta!,
      progreso: progreso!,
    },
  };
}

// --------------------------------------------------------- Persistencia
//
// Lo guardado en localStorage es entrada NO fiable (versiones antiguas,
// ediciones a mano, extensiones). Se valida TODO antes de usarlo y, si algo
// no cumple, se descarta el estado completo y la demo vuelve a los datos
// iniciales. No se aceptan estados parciales: evitaría, por ejemplo, que una
// pendiente ya evaluada reapareciera al perder solo su evaluación.

export const CLAVE_ALMACEN = "evora-padel-demo-v1";
/** Tope defensivo de registros por colección. */
export const MAX_REGISTROS = 5000;
/** Margen de días aceptado para el vencimiento de una pendiente. */
export const MAX_DIAS_VENCIMIENTO = 3650;
const MAX_ID = 100;

type Registro = Record<string, unknown>;

function esRegistro(v: unknown): v is Registro {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function esId(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "" && v.length <= MAX_ID;
}

function esEnteroEntre(v: unknown, min: number, max: number): v is number {
  return Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
}

/** "AAAA-MM-DD" que además es una fecha real del calendario (rechaza 2026-02-30). */
export function esFechaIso(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const fecha = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === v;
}

function lista(v: unknown): unknown[] | null {
  return Array.isArray(v) && v.length <= MAX_REGISTROS ? v : null;
}

function idsUnicos(registros: { id: string }[]): boolean {
  return new Set(registros.map((r) => r.id)).size === registros.length;
}

function leerPendiente(v: unknown, ids: Set<string>): EvaluacionPendiente | null {
  if (!esRegistro(v)) return null;
  const { id, jugadorId, tipo, venceEnDias } = v;
  if (!esId(id) || !esId(jugadorId) || !ids.has(jugadorId)) return null;
  if (!esTipoEvaluacion(tipo)) return null;
  if (!esEnteroEntre(venceEnDias, -MAX_DIAS_VENCIMIENTO, MAX_DIAS_VENCIMIENTO)) return null;
  return { id, jugadorId, tipo, venceEnDias };
}

function leerEvaluacion(v: unknown, ids: Set<string>): EvaluacionRealizada | null {
  if (!esRegistro(v)) return null;
  const { id, jugadorId, tipo, fecha, notas, comentario } = v;
  if (!esId(id) || !esId(jugadorId) || !ids.has(jugadorId)) return null;
  if (!esTipoEvaluacion(tipo) || !esFechaIso(fecha)) return null;
  if (typeof comentario !== "string" || comentario.length > MAX_COMENTARIO) return null;
  if (!esRegistro(notas)) return null;
  const limpias: Partial<Record<CriterioId, Nota>> = {};
  for (const c of CRITERIOS) {
    const nota = notas[c.id];
    if (!esNota(nota)) return null;
    limpias[c.id] = nota;
  }
  // Se reconstruye el objeto: los campos desconocidos no pasan.
  return { id, jugadorId, tipo, fecha, notas: limpias as Record<CriterioId, Nota>, comentario };
}

function leerObjetivo(v: unknown, ids: Set<string>): Objetivo | null {
  if (!esRegistro(v)) return null;
  const { id, jugadorId, titulo, area, meta, progreso } = v;
  if (!esId(id) || !esId(jugadorId) || !ids.has(jugadorId)) return null;
  if (typeof titulo !== "string") return null;
  const limpio = normalizarTitulo(titulo);
  if (limpio.length < LARGO_TITULO.min || limpio.length > LARGO_TITULO.max) return null;
  if (typeof area !== "string" || !(AREAS as readonly string[]).includes(area)) return null;
  if (!esEnteroEntre(meta, 1, MAX_META) || !esEnteroEntre(progreso, 0, meta)) return null;
  return { id, jugadorId, titulo: limpio, area: area as Area, meta, progreso };
}

function leerTodos<T extends { id: string }>(
  valores: unknown,
  leer: (v: unknown, ids: Set<string>) => T | null,
  ids: Set<string>,
): T[] | null {
  const arr = lista(valores);
  if (!arr) return null;
  const leidos: T[] = [];
  for (const v of arr) {
    const r = leer(v, ids);
    if (!r) return null;
    leidos.push(r);
  }
  return idsUnicos(leidos) ? leidos : null;
}

/**
 * Valida un estado ya parseado. Devuelve una copia limpia o null si cualquier
 * registro es inválido (campos obligatorios, tipos, rangos, áreas, tipos de
 * evaluación, fechas reales, ids únicos y jugadores existentes).
 */
export function validarEstadoGuardado(
  datos: unknown,
  jugadores: readonly Jugador[] = jugadoresDemo,
): Estado | null {
  if (!esRegistro(datos)) return null;
  const ids = new Set(jugadores.map((j) => j.id));
  const pendientes = leerTodos(datos.pendientes, leerPendiente, ids);
  const evaluaciones = leerTodos(datos.evaluaciones, leerEvaluacion, ids);
  const objetivos = leerTodos(datos.objetivos, leerObjetivo, ids);
  if (!pendientes || !evaluaciones || !objetivos) return null;
  return { pendientes, evaluaciones, objetivos };
}

/** Lee el texto guardado; null si falta, no es JSON o no supera la validación. */
export function deserializarEstado(
  json: string | null,
  jugadores: readonly Jugador[] = jugadoresDemo,
): Estado | null {
  if (!json) return null;
  let datos: unknown;
  try {
    datos = JSON.parse(json);
  } catch {
    return null;
  }
  return validarEstadoGuardado(datos, jugadores);
}
