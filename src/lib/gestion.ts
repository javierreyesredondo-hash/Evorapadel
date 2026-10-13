// Lógica pura de la gestión REAL de jugadores y grupos (Supabase), sin React
// ni Next, para poder probarla con `node --test`.
//
// Los valores y límites reflejan EXACTAMENTE el esquema de
// supabase/migrations/20261012190000_fundacion_escuelas.sql.

export type NivelBD = "iniciacion" | "intermedio" | "avanzado" | "competicion";
export type PosicionBD = "drive" | "reves";
export type ManoBD = "diestro" | "zurdo";

export const NIVEL_TEXTO: Record<NivelBD, string> = {
  iniciacion: "Iniciación",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
  competicion: "Competición",
};
export const POSICION_TEXTO: Record<PosicionBD, string> = { drive: "Drive", reves: "Revés" };
export const MANO_TEXTO: Record<ManoBD, string> = { diestro: "Diestro/a", zurdo: "Zurdo/a" };

export const NIVELES_BD = Object.keys(NIVEL_TEXTO) as NivelBD[];
export const POSICIONES_BD = Object.keys(POSICION_TEXTO) as PosicionBD[];
export const MANOS_BD = Object.keys(MANO_TEXTO) as ManoBD[];

/** Límites de las restricciones CHECK de la base de datos. */
export const LIMITES = {
  nombreJugador: { min: 2, max: 120 },
  foco: { max: 200 },
  nombreGrupo: { min: 1, max: 80 },
  fechaMinima: "1900-01-01",
} as const;

/** Fila de public.jugadores tal y como la usa la app. */
export type JugadorReal = {
  id: string;
  nombre: string;
  fecha_nacimiento: string | null;
  mano: ManoBD | null;
  nivel: NivelBD | null;
  posicion: PosicionBD | null;
  foco: string | null;
  activo: boolean;
  grupos: { id: string; nombre: string }[];
};

export type GrupoReal = {
  id: string;
  nombre: string;
  entrenador_id: string | null;
  jugadores: { id: string; nombre: string; activo: boolean }[];
};

/** Miembro de la escuela (para elegir entrenador de un grupo). */
export type Miembro = { usuarioId: string; rol: "director" | "entrenador"; nombre: string | null };

export type Validacion<T> = { ok: true; valor: T } | { ok: false; errores: Record<string, string> };

/** Columnas editables de jugadores (las mismas que conceden los GRANT). */
export type DatosJugador = {
  nombre: string;
  fecha_nacimiento: string | null;
  mano: ManoBD | null;
  nivel: NivelBD | null;
  posicion: PosicionBD | null;
  foco: string | null;
};

export type DatosGrupo = { nombre: string; entrenador_id: string | null };

/** Espacios al principio y al final fuera, y espacios repetidos reducidos a uno. */
export function limpiarTexto(texto: unknown): string {
  return typeof texto === "string" ? texto.replace(/\s+/g, " ").trim() : "";
}

/** Para comparar nombres: sin tildes, sin mayúsculas y sin espacios sobrantes. */
export function claveNombre(texto: string): string {
  return limpiarTexto(texto).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** "AAAA-MM-DD" que además es una fecha real del calendario (rechaza 2026-02-30). */
export function esFechaIso(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const fecha = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === v;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function esUuid(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}

function opcion<T extends string>(valor: unknown, validos: readonly T[]): T | null | undefined {
  const v = limpiarTexto(valor);
  if (v === "") return null;
  return (validos as readonly string[]).includes(v) ? (v as T) : undefined;
}

/**
 * Valida el formulario de jugador y lo convierte en las columnas de la tabla.
 * `hoy` (AAAA-MM-DD) permite probar el límite de la fecha futura.
 */
export function validarJugador(entrada: Record<string, unknown>, hoy: string): Validacion<DatosJugador> {
  const errores: Record<string, string> = {};

  const nombre = limpiarTexto(entrada.nombre);
  if (nombre.length < LIMITES.nombreJugador.min) errores.nombre = "Escribe el nombre del jugador (al menos 2 caracteres).";
  else if (nombre.length > LIMITES.nombreJugador.max) errores.nombre = `El nombre no puede pasar de ${LIMITES.nombreJugador.max} caracteres.`;

  const fechaTexto = limpiarTexto(entrada.fecha_nacimiento);
  let fecha: string | null = null;
  if (fechaTexto !== "") {
    if (!esFechaIso(fechaTexto) || fechaTexto < LIMITES.fechaMinima) errores.fecha_nacimiento = "Escribe una fecha de nacimiento válida.";
    else if (fechaTexto > hoy) errores.fecha_nacimiento = "La fecha de nacimiento no puede ser futura.";
    else fecha = fechaTexto;
  }

  const mano = opcion(entrada.mano, MANOS_BD);
  if (mano === undefined) errores.mano = "Elige una opción de la lista.";
  const nivel = opcion(entrada.nivel, NIVELES_BD);
  if (nivel === undefined) errores.nivel = "Elige una opción de la lista.";
  const posicion = opcion(entrada.posicion, POSICIONES_BD);
  if (posicion === undefined) errores.posicion = "Elige una opción de la lista.";

  const foco = limpiarTexto(entrada.foco);
  if (foco.length > LIMITES.foco.max) errores.foco = `El foco no puede pasar de ${LIMITES.foco.max} caracteres.`;

  if (Object.keys(errores).length > 0) return { ok: false, errores };
  return {
    ok: true,
    valor: {
      nombre,
      fecha_nacimiento: fecha,
      mano: mano ?? null,
      nivel: nivel ?? null,
      posicion: posicion ?? null,
      foco: foco === "" ? null : foco,
    },
  };
}

/** Valida el formulario de grupo. El entrenador debe ser miembro de la escuela. */
export function validarGrupo(entrada: Record<string, unknown>, idsMiembros: ReadonlySet<string>): Validacion<DatosGrupo> {
  const errores: Record<string, string> = {};
  const nombre = limpiarTexto(entrada.nombre);
  if (nombre.length < LIMITES.nombreGrupo.min) errores.nombre = "Escribe el nombre del grupo.";
  else if (nombre.length > LIMITES.nombreGrupo.max) errores.nombre = `El nombre no puede pasar de ${LIMITES.nombreGrupo.max} caracteres.`;

  const entrenador = limpiarTexto(entrada.entrenador_id);
  if (entrenador !== "" && !idsMiembros.has(entrenador)) errores.entrenador_id = "Elige un miembro de tu escuela.";

  if (Object.keys(errores).length > 0) return { ok: false, errores };
  return { ok: true, valor: { nombre, entrenador_id: entrenador === "" ? null : entrenador } };
}

/** Otro jugador con el mismo nombre (sin tildes ni mayúsculas), salvo `excluirId`. */
export function buscarHomonimo<T extends { id: string; nombre: string }>(lista: readonly T[], nombre: string, excluirId?: string): T | undefined {
  const clave = claveNombre(nombre);
  return lista.find((j) => j.id !== excluirId && claveNombre(j.nombre) === clave);
}

/** Edad cumplida en `hoy` (AAAA-MM-DD), o null sin fecha. */
export function edad(fechaNacimiento: string | null, hoy: string): number | null {
  if (!fechaNacimiento || !esFechaIso(fechaNacimiento)) return null;
  const [a, m, d] = fechaNacimiento.split("-").map(Number);
  const [ha, hm, hd] = hoy.split("-").map(Number);
  return ha - a - (hm < m || (hm === m && hd < d) ? 1 : 0);
}

/** Resumen de una línea: "Avanzado · Revés · 17 años". */
export function resumenJugadorReal(j: Pick<JugadorReal, "nivel" | "posicion" | "fecha_nacimiento">, hoy: string): string {
  const partes = [j.nivel && NIVEL_TEXTO[j.nivel], j.posicion && POSICION_TEXTO[j.posicion]];
  const anos = edad(j.fecha_nacimiento, hoy);
  if (anos !== null) partes.push(`${anos} ${anos === 1 ? "año" : "años"}`);
  return partes.filter(Boolean).join(" · ") || "Sin datos deportivos";
}

/** Nombre para mostrar de un miembro de la escuela. */
export function nombreMiembro(m: Miembro, usuarioActual?: string): string {
  const rol = m.rol === "director" ? "Director/a" : "Entrenador/a";
  const base = m.nombre ? `${m.nombre} (${rol})` : `${rol} sin nombre visible`;
  return m.usuarioId === usuarioActual ? `${base} · tú` : base;
}

type ErrorBD = { code?: string | null; message?: string | null } | null | undefined;

/**
 * Mensaje en español para un error de PostgREST/PostgreSQL. `contexto` permite
 * personalizar los duplicados (23505), que dependen de la tabla.
 */
export function mensajeErrorBD(error: ErrorBD, contexto: { duplicado?: string } = {}): string {
  switch (error?.code) {
    case "42501":
      return "No tienes permiso para hacer esto en tu escuela.";
    case "23505":
      return contexto.duplicado ?? "Ya existe un registro igual.";
    case "23503":
      return "El jugador, el grupo o el entrenador ya no existe o es de otra escuela.";
    case "23514":
    case "22007":
    case "22008":
    case "22P02":
      return "Algún dato no es válido. Revisa el formulario.";
    case "PGRST301":
    case "PGRST303":
      return "Tu sesión ha caducado. Vuelve a iniciar sesión.";
    default:
      return "No se ha podido guardar. Inténtalo de nuevo en unos minutos.";
  }
}

/** Normaliza las filas de jugadores con sus grupos embebidos (PostgREST). */
export function normalizarJugador(fila: Record<string, unknown>): JugadorReal {
  const asignaciones = Array.isArray(fila.grupo_jugadores) ? fila.grupo_jugadores : [];
  const grupos = asignaciones
    .map((a) => (a as { grupo?: unknown }).grupo)
    .map((g) => (Array.isArray(g) ? g[0] : g) as { id?: unknown; nombre?: unknown } | undefined)
    .filter((g): g is { id: string; nombre: string } => typeof g?.id === "string" && typeof g?.nombre === "string")
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return {
    id: String(fila.id),
    nombre: String(fila.nombre),
    fecha_nacimiento: (fila.fecha_nacimiento as string | null) ?? null,
    mano: (fila.mano as ManoBD | null) ?? null,
    nivel: (fila.nivel as NivelBD | null) ?? null,
    posicion: (fila.posicion as PosicionBD | null) ?? null,
    foco: (fila.foco as string | null) ?? null,
    activo: fila.activo === true,
    grupos,
  };
}

/** Normaliza un grupo con sus jugadores embebidos (PostgREST). */
export function normalizarGrupo(fila: Record<string, unknown>): GrupoReal {
  const asignaciones = Array.isArray(fila.grupo_jugadores) ? fila.grupo_jugadores : [];
  const jugadores = asignaciones
    .map((a) => (a as { jugador?: unknown }).jugador)
    .map((j) => (Array.isArray(j) ? j[0] : j) as { id?: unknown; nombre?: unknown; activo?: unknown } | undefined)
    .filter((j): j is { id: string; nombre: string; activo: boolean } => typeof j?.id === "string" && typeof j?.nombre === "string")
    .map((j) => ({ id: j.id, nombre: j.nombre, activo: j.activo === true }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return {
    id: String(fila.id),
    nombre: String(fila.nombre),
    entrenador_id: (fila.entrenador_id as string | null) ?? null,
    jugadores,
  };
}

/** Filtro de la lista real: texto (nombre, foco, grupos), nivel y estado. */
export function filtrarJugadoresReales(
  lista: readonly JugadorReal[],
  filtros: { texto: string; nivel: NivelBD | null; estado: "activos" | "archivados" },
): JugadorReal[] {
  const palabras = claveNombre(filtros.texto).split(" ").filter(Boolean);
  return lista.filter((j) => {
    if (j.activo !== (filtros.estado === "activos")) return false;
    if (filtros.nivel && j.nivel !== filtros.nivel) return false;
    const texto = claveNombre([j.nombre, j.foco ?? "", ...j.grupos.map((g) => g.nombre)].join(" "));
    return palabras.every((p) => texto.includes(p));
  });
}

/**
 * Funciones de una persona en su escuela. El rol (director/entrenador) marca
 * sus permisos; entrenar depende de los grupos que tiene asignados. Un director
 * con grupos dirige Y entrena con la misma cuenta y sin perder permisos.
 */
export function textoFunciones(rol: "director" | "entrenador", gruposQueEntrena: number): string {
  const grupos = `${gruposQueEntrena} ${gruposQueEntrena === 1 ? "grupo" : "grupos"}`;
  if (rol === "director") return gruposQueEntrena > 0 ? `Dirección y entrenamiento · entrena ${grupos}` : "Dirección";
  return gruposQueEntrena > 0 ? `Entrenamiento · ${grupos}` : "Entrenamiento · sin grupos asignados";
}
