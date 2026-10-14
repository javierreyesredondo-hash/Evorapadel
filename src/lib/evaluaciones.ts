// Lógica pura de las evaluaciones REALES (sin React, Next ni Supabase), para
// poder probarla con `node --test`. Los límites reflejan exactamente
// supabase/migrations/20261014090000_evaluaciones.sql.

import { esFechaIso, esUuid, limpiarTexto, type Validacion } from "./gestion.ts";
import type { AreaCompetencia } from "./metodologia.ts";

export type TipoEvaluacion = "rapida" | "completa";

export const TIPO_TEXTO: Record<TipoEvaluacion, string> = {
  rapida: "Evaluación rápida",
  completa: "Evaluación completa",
};
export const TIPO_AYUDA: Record<TipoEvaluacion, string> = {
  rapida: "Durante el entrenamiento: puntúa solo lo que hayas observado hoy.",
  completa: "Periódica: puntúa todas las competencias de la metodología.",
};

export const LIMITES_EVALUACION = {
  titulo: 80,
  fortalezas: 1500,
  mejoras: 1500,
  interpretacion: 2000,
  observaciones: 3000,
  objetivos: 5,
  objetivo: { min: 2, max: 200 },
  fechaMinima: "2000-01-01",
} as const;

export type Competencia = {
  id: string;
  nombre: string;
  /** Área de ÉVORA (competencias propias) o null si viene de una metodología importada. */
  area: AreaCompetencia | null;
  /** Grupo original de la metodología importada (p. ej. «Toma de decisiones»). */
  grupo?: string | null;
  /** Metodología importada a la que pertenece (no se edita). */
  metodologiaId?: string | null;
  descripcion: string | null;
  orden: number;
  activa: boolean;
};

export type Nota = 1 | 2 | 3 | 4 | 5;

/** Puntuación de una competencia en una evaluación (con los datos de la competencia). */
export type PuntuacionCompetencia = {
  competenciaId: string;
  nombre: string;
  area: AreaCompetencia | null;
  grupo?: string | null;
  orden: number;
  puntuacion: Nota;
};

export type ObjetivoEvaluacion = { descripcion: string; plazo: string | null };

/** Lo que guarda public.guardar_evaluacion (ya validado). */
export type DatosEvaluacion = {
  tipo: TipoEvaluacion;
  fecha: string;
  titulo: string | null;
  grupoId: string | null;
  fortalezas: string | null;
  mejoras: string | null;
  interpretacion: string | null;
  observaciones: string | null;
  puntuaciones: { competencia: string; puntuacion: Nota }[];
  objetivos: ObjetivoEvaluacion[];
};

/** Suma `dias` a una fecha AAAA-MM-DD. */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Texto multilínea: conserva los saltos de línea, recorta espacios sobrantes. */
export function limpiarParrafo(texto: unknown): string {
  if (typeof texto !== "string") return "";
  return texto
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function esNota(v: string): boolean {
  return /^[1-5]$/.test(v);
}

/**
 * Valida el formulario de evaluación.
 *   entrada.notas: { [competenciaId]: "" | "1".."5" } — "" = no evaluada.
 *   competencias: las que se pueden puntuar (activas, y al editar también las
 *   que ya tenía la evaluación). En una evaluación completa son obligatorias
 *   todas las ACTIVAS.
 *   hoy: AAAA-MM-DD del servidor (se admite 1 día de margen por la zona horaria).
 */
export function validarEvaluacion(
  entrada: {
    tipo?: unknown;
    fecha?: unknown;
    titulo?: unknown;
    grupoId?: unknown;
    fortalezas?: unknown;
    mejoras?: unknown;
    interpretacion?: unknown;
    observaciones?: unknown;
    notas: Record<string, unknown>;
    objetivos: { descripcion?: unknown; plazo?: unknown }[];
  },
  competencias: readonly Pick<Competencia, "id" | "activa">[],
  hoy: string,
): Validacion<DatosEvaluacion> {
  const errores: Record<string, string> = {};

  const tipo = limpiarTexto(entrada.tipo);
  if (tipo !== "rapida" && tipo !== "completa") errores.tipo = "Elige el tipo de evaluación.";

  const fecha = limpiarTexto(entrada.fecha);
  if (!esFechaIso(fecha) || fecha < LIMITES_EVALUACION.fechaMinima) errores.fecha = "Escribe una fecha válida.";
  else if (fecha > sumarDias(hoy, 1)) errores.fecha = "La fecha no puede ser futura.";

  const titulo = limpiarTexto(entrada.titulo);
  if (titulo.length > LIMITES_EVALUACION.titulo) errores.titulo = `Máximo ${LIMITES_EVALUACION.titulo} caracteres.`;

  const grupo = limpiarTexto(entrada.grupoId);
  if (grupo !== "" && !esUuid(grupo)) errores.grupoId = "Elige un grupo de la lista.";

  const textos = {} as Record<"fortalezas" | "mejoras" | "interpretacion" | "observaciones", string | null>;
  for (const campo of ["fortalezas", "mejoras", "interpretacion", "observaciones"] as const) {
    const t = limpiarParrafo(entrada[campo]);
    if (t.length > LIMITES_EVALUACION[campo]) errores[campo] = `Máximo ${LIMITES_EVALUACION[campo]} caracteres (ahora ${t.length}).`;
    textos[campo] = t === "" ? null : t;
  }

  // Notas: solo de competencias permitidas; cualquier otra clave se ignora.
  const puntuaciones: DatosEvaluacion["puntuaciones"] = [];
  for (const c of competencias) {
    const v = limpiarTexto(entrada.notas[c.id]);
    if (v === "") {
      if (tipo === "completa" && c.activa) errores[`nota_${c.id}`] = "Puntúa esta competencia: la evaluación completa las incluye todas.";
      continue;
    }
    if (!esNota(v)) errores[`nota_${c.id}`] = "Elige una nota del 1 al 5.";
    else puntuaciones.push({ competencia: c.id, puntuacion: Number(v) as Nota });
  }
  if (puntuaciones.length === 0 && !Object.keys(errores).some((k) => k.startsWith("nota_"))) {
    errores.notas = "Puntúa al menos una competencia.";
  }

  const objetivos: ObjetivoEvaluacion[] = [];
  entrada.objetivos.slice(0, LIMITES_EVALUACION.objetivos).forEach((o, i) => {
    const descripcion = limpiarTexto(o.descripcion);
    const plazo = limpiarTexto(o.plazo);
    if (descripcion === "" && plazo === "") return;
    if (descripcion.length < LIMITES_EVALUACION.objetivo.min) {
      errores[`objetivo_${i}`] = "Describe el objetivo (al menos 2 caracteres).";
    } else if (descripcion.length > LIMITES_EVALUACION.objetivo.max) {
      errores[`objetivo_${i}`] = `Máximo ${LIMITES_EVALUACION.objetivo.max} caracteres.`;
    }
    if (plazo !== "" && !esFechaIso(plazo)) errores[`plazo_${i}`] = "Escribe una fecha válida.";
    else if (plazo !== "" && esFechaIso(fecha) && plazo < fecha) errores[`plazo_${i}`] = "El plazo no puede ser anterior a la evaluación.";
    objetivos.push({ descripcion, plazo: plazo === "" ? null : plazo });
  });

  if (Object.keys(errores).length > 0) return { ok: false, errores };
  return {
    ok: true,
    valor: {
      tipo: tipo as TipoEvaluacion,
      fecha,
      titulo: titulo === "" ? null : titulo,
      grupoId: grupo === "" ? null : grupo,
      ...textos,
      puntuaciones,
      objetivos,
    },
  };
}

/** Media de las notas (sin redondear), o null si no hay ninguna. */
export function media(notas: readonly { puntuacion: number }[]): number | null {
  if (notas.length === 0) return null;
  return notas.reduce((s, n) => s + n.puntuacion, 0) / notas.length;
}

/** "3,8" — un decimal con coma. */
export function textoMediaEvaluacion(valor: number | null): string {
  return valor === null ? "—" : valor.toFixed(1).replace(".", ",");
}

export type Comparacion = {
  fechaAnterior: string;
  filas: { competenciaId: string; nombre: string; anterior: Nota; actual: Nota; diferencia: number }[];
  /** Medias calculadas SOLO sobre las competencias comunes. */
  mediaAnterior: number;
  mediaActual: number;
  /** Competencias de la evaluación actual que la anterior no tenía (no se comparan). */
  sinComparar: number;
};

/**
 * Compara dos evaluaciones del mismo jugador SOLO en las competencias que
 * puntúan ambas. Si no comparten ninguna, devuelve null: no se inventa evolución.
 */
export function compararEvaluaciones(
  actual: readonly PuntuacionCompetencia[],
  anterior: { fecha: string; puntuaciones: readonly { competenciaId: string; puntuacion: Nota }[] } | null,
): Comparacion | null {
  if (!anterior) return null;
  const previas = new Map(anterior.puntuaciones.map((p) => [p.competenciaId, p.puntuacion]));
  const filas = actual
    .filter((p) => previas.has(p.competenciaId))
    .map((p) => {
      const ant = previas.get(p.competenciaId)!;
      return { competenciaId: p.competenciaId, nombre: p.nombre, anterior: ant, actual: p.puntuacion, diferencia: p.puntuacion - ant };
    });
  if (filas.length === 0) return null;
  return {
    fechaAnterior: anterior.fecha,
    filas,
    mediaAnterior: filas.reduce((s, f) => s + f.anterior, 0) / filas.length,
    mediaActual: filas.reduce((s, f) => s + f.actual, 0) / filas.length,
    sinComparar: actual.length - filas.length,
  };
}

/** "+1", "−2" o "=" para una diferencia de notas. */
export function textoDiferencia(d: number): string {
  if (d > 0) return `+${d}`;
  if (d < 0) return `−${Math.abs(d)}`;
  return "=";
}

/** Nombre de archivo seguro: informe-lucia-marvan-2026-10-12.pdf */
export function nombreArchivoInforme(jugador: string, fecha: string): string {
  const base = jugador
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `informe-${base || "jugador"}-${esFechaIso(fecha) ? fecha : "evaluacion"}.pdf`;
}

/** Ordena notas como la metodología (orden y nombre). */
export function ordenarPuntuaciones<T extends { orden: number; nombre: string }>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"));
}

export type DatosCompetencia = { nombre: string; area: AreaCompetencia; descripcion: string | null; orden: number; activa: boolean };

const AREAS_VALIDAS: readonly string[] = ["tecnica", "tactica", "fisica", "mental"];

/** Valida el formulario de competencia (metodología de la escuela). */
export function validarCompetencia(entrada: Record<string, unknown>): Validacion<DatosCompetencia> {
  const errores: Record<string, string> = {};
  const nombre = limpiarTexto(entrada.nombre);
  if (nombre.length < 2) errores.nombre = "Escribe el nombre de la competencia (al menos 2 caracteres).";
  else if (nombre.length > 80) errores.nombre = "Máximo 80 caracteres.";
  const area = limpiarTexto(entrada.area);
  if (!AREAS_VALIDAS.includes(area)) errores.area = "Elige un área.";
  const descripcion = limpiarTexto(entrada.descripcion);
  if (descripcion.length > 300) errores.descripcion = "Máximo 300 caracteres.";
  const ordenTexto = limpiarTexto(entrada.orden);
  const orden = ordenTexto === "" ? 0 : Number(ordenTexto);
  if (!Number.isInteger(orden) || orden < 0 || orden > 999) errores.orden = "Escribe un número entre 0 y 999.";
  if (Object.keys(errores).length > 0) return { ok: false, errores };
  return {
    ok: true,
    valor: { nombre, area: area as AreaCompetencia, descripcion: descripcion === "" ? null : descripcion, orden, activa: entrada.activa !== "no" },
  };
}
