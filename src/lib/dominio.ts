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

/** Media de las notas (1–5) con un decimal. */
export function mediaNotas(notas: Record<CriterioId, Nota>): number {
  const valores = CRITERIOS.map((c) => notas[c.id]);
  const media = valores.reduce<number>((a, b) => a + b, 0) / valores.length;
  return Math.round(media * 10) / 10;
}

/** Puntuación global 0–100 de una evaluación: media × 20 (1 → 20, 5 → 100). */
export function puntuacionGlobal(notas: Record<CriterioId, Nota>): number {
  const valores = CRITERIOS.map((c) => notas[c.id]);
  return Math.round((valores.reduce<number>((a, b) => a + b, 0) / valores.length) * 20);
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
  if (!entrada.tipo.trim()) {
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
  const titulo = entrada.titulo.trim().replace(/\s+/g, " ");
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

export const CLAVE_ALMACEN = "evora-padel-demo-v1";

function esArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

/** Lee el estado guardado; devuelve null si falta o no tiene la forma esperada. */
export function deserializarEstado(json: string | null): Estado | null {
  if (!json) return null;
  try {
    const datos = JSON.parse(json) as Partial<Record<keyof Estado, unknown>>;
    if (!datos || !esArray(datos.pendientes) || !esArray(datos.evaluaciones) || !esArray(datos.objetivos)) {
      return null;
    }
    const evaluacionesOk = datos.evaluaciones.every(
      (e) =>
        typeof e === "object" && e !== null &&
        typeof (e as EvaluacionRealizada).jugadorId === "string" &&
        typeof (e as EvaluacionRealizada).fecha === "string" &&
        CRITERIOS.every((c) => esNota((e as EvaluacionRealizada).notas?.[c.id])),
    );
    const objetivosOk = datos.objetivos.every(
      (o) =>
        typeof o === "object" && o !== null &&
        typeof (o as Objetivo).titulo === "string" &&
        Number.isInteger((o as Objetivo).progreso) &&
        Number.isInteger((o as Objetivo).meta),
    );
    if (!evaluacionesOk || !objetivosOk) return null;
    return datos as Estado;
  } catch {
    return null;
  }
}

