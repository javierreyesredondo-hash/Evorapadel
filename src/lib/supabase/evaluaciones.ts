import "server-only";
import { hoyIso } from "@/lib/format";
import { esUuid } from "@/lib/gestion";
import {
  compararEvaluaciones,
  media,
  ordenarPuntuaciones,
  type Competencia,
  type Nota,
  type ObjetivoEvaluacion,
  type PuntuacionCompetencia,
  type TipoEvaluacion,
} from "@/lib/evaluaciones";
import type { InformeEvaluacion } from "@/lib/informe";
import type { AreaCompetencia } from "@/lib/metodologia";
import type { ContextoEscuela, Resultado } from "@/lib/supabase/gestion";

// Lecturas de competencias y evaluaciones REALES de la escuela activa.
// Igual que en gestion.ts: la escuela sale de la sesión verificada, toda
// consulta filtra por ella y RLS lo impone además en la base de datos.
// Los errores se registran sin datos personales (solo código y mensaje técnico).

const ERROR_LECTURA = "No se han podido cargar las evaluaciones. Vuelve a intentarlo en unos minutos.";

function registrar(origen: string, error: { code?: string; message?: string } | null) {
  console.error(`ÉVORA PADEL: error al leer ${origen}`, error?.code, error?.message);
}

const uno = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

// ------------------------------------------------------------- competencias

export async function listarCompetencias(ctx: ContextoEscuela): Promise<Resultado<Competencia[]>> {
  const { data, error } = await ctx.supabase
    .from("competencias")
    .select("id, nombre, area, descripcion, orden, activa")
    .eq("escuela_id", ctx.escuelaId)
    .order("orden")
    .order("nombre");
  if (error) {
    registrar("competencias", error);
    return { ok: false, mensaje: ERROR_LECTURA };
  }
  return {
    ok: true,
    datos: (data ?? []).map((c) => ({
      id: c.id as string,
      nombre: c.nombre as string,
      area: c.area as AreaCompetencia,
      descripcion: (c.descripcion as string | null) ?? null,
      orden: c.orden as number,
      activa: c.activa === true,
    })),
  };
}

// ---------------------------------------------------------------- historial

export type ResumenEvaluacion = {
  id: string;
  fecha: string;
  tipo: TipoEvaluacion;
  titulo: string | null;
  media: number | null;
  numero: number;
  jugador?: { id: string; nombre: string };
};

const SELECT_RESUMEN = "id, fecha, tipo, titulo, created_at, evaluacion_puntuaciones(puntuacion)";

function aResumen(f: Record<string, unknown>): ResumenEvaluacion {
  const notas = (Array.isArray(f.evaluacion_puntuaciones) ? f.evaluacion_puntuaciones : []) as { puntuacion: number }[];
  const jugador = uno(f.jugador as { id: string; nombre: string } | null);
  return {
    id: f.id as string,
    fecha: f.fecha as string,
    tipo: f.tipo as TipoEvaluacion,
    titulo: (f.titulo as string | null) ?? null,
    media: media(notas),
    numero: notas.length,
    ...(jugador ? { jugador } : {}),
  };
}

/** Últimas evaluaciones de un jugador (más recientes primero), sin descargar todo el historial. */
export async function listarEvaluacionesJugador(ctx: ContextoEscuela, jugadorId: string, limite = 20): Promise<Resultado<ResumenEvaluacion[]>> {
  if (!esUuid(jugadorId)) return { ok: true, datos: [] };
  const { data, error } = await ctx.supabase
    .from("evaluaciones")
    .select(SELECT_RESUMEN)
    .eq("escuela_id", ctx.escuelaId)
    .eq("jugador_id", jugadorId)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) {
    registrar("historial", error);
    return { ok: false, mensaje: ERROR_LECTURA };
  }
  return { ok: true, datos: (data ?? []).map((f) => aResumen(f as Record<string, unknown>)) };
}

/** Evaluaciones más recientes de la escuela (para la pantalla Evaluaciones). */
export async function listarEvaluacionesRecientes(ctx: ContextoEscuela, limite = 30): Promise<Resultado<ResumenEvaluacion[]>> {
  const { data, error } = await ctx.supabase
    .from("evaluaciones")
    .select(`${SELECT_RESUMEN}, jugador:jugadores(id, nombre)`)
    .eq("escuela_id", ctx.escuelaId)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) {
    registrar("evaluaciones recientes", error);
    return { ok: false, mensaje: ERROR_LECTURA };
  }
  return { ok: true, datos: (data ?? []).map((f) => aResumen(f as Record<string, unknown>)) };
}

// ------------------------------------------------------------------ detalle

export type EvaluacionCompleta = {
  id: string;
  tipo: TipoEvaluacion;
  fecha: string;
  createdAt: string;
  titulo: string | null;
  fortalezas: string | null;
  mejoras: string | null;
  observaciones: string | null;
  entrenadorId: string | null;
  jugador: { id: string; nombre: string; nivel: string | null; activo: boolean };
  grupo: { id: string; nombre: string } | null;
  puntuaciones: PuntuacionCompetencia[];
  objetivos: ObjetivoEvaluacion[];
};

const SELECT_DETALLE = [
  "id, tipo, fecha, created_at, titulo, fortalezas, mejoras, observaciones, entrenador_id",
  "jugador:jugadores(id, nombre, nivel, activo)",
  "grupo:grupos(id, nombre)",
  "evaluacion_puntuaciones(puntuacion, competencia:competencias(id, nombre, area, orden))",
  "evaluacion_objetivos(descripcion, plazo, orden)",
].join(", ");

/** Evaluación de la escuela activa, o null si no existe o es de otra escuela (mismo resultado). */
export async function obtenerEvaluacion(ctx: ContextoEscuela, id: string): Promise<Resultado<EvaluacionCompleta | null>> {
  if (!esUuid(id)) return { ok: true, datos: null };
  const { data, error } = await ctx.supabase
    .from("evaluaciones")
    .select(SELECT_DETALLE)
    .eq("escuela_id", ctx.escuelaId)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    registrar("evaluación", error);
    return { ok: false, mensaje: ERROR_LECTURA };
  }
  if (!data) return { ok: true, datos: null };
  const f = data as unknown as Record<string, unknown>;
  const jugador = uno(f.jugador as EvaluacionCompleta["jugador"] | null);
  if (!jugador) return { ok: true, datos: null };
  const notas = (Array.isArray(f.evaluacion_puntuaciones) ? f.evaluacion_puntuaciones : []) as {
    puntuacion: Nota;
    competencia: { id: string; nombre: string; area: AreaCompetencia; orden: number } | { id: string; nombre: string; area: AreaCompetencia; orden: number }[] | null;
  }[];
  const puntuaciones = ordenarPuntuaciones(
    notas
      .map((n) => ({ n, c: uno(n.competencia) }))
      .filter((x): x is { n: (typeof notas)[number]; c: NonNullable<typeof x.c> } => x.c !== null)
      .map(({ n, c }) => ({ competenciaId: c.id, nombre: c.nombre, area: c.area, orden: c.orden, puntuacion: n.puntuacion })),
  );
  const objetivos = ((Array.isArray(f.evaluacion_objetivos) ? f.evaluacion_objetivos : []) as (ObjetivoEvaluacion & { orden: number })[])
    .sort((a, b) => a.orden - b.orden)
    .map(({ descripcion, plazo }) => ({ descripcion, plazo: plazo ?? null }));
  return {
    ok: true,
    datos: {
      id: f.id as string,
      tipo: f.tipo as TipoEvaluacion,
      fecha: f.fecha as string,
      createdAt: f.created_at as string,
      titulo: (f.titulo as string | null) ?? null,
      fortalezas: (f.fortalezas as string | null) ?? null,
      mejoras: (f.mejoras as string | null) ?? null,
      observaciones: (f.observaciones as string | null) ?? null,
      entrenadorId: (f.entrenador_id as string | null) ?? null,
      jugador,
      grupo: uno(f.grupo as { id: string; nombre: string } | null),
      puntuaciones,
      objetivos,
    },
  };
}

/** ¿Puede el usuario editarla? Igual que la política evaluaciones_editar (RLS decide en último término). */
export function puedeEditar(ctx: ContextoEscuela, ev: Pick<EvaluacionCompleta, "entrenadorId">): boolean {
  return ctx.rol === "director" || ev.entrenadorId === ctx.usuarioId;
}

/**
 * Evaluación anterior COMPARABLE: mismo jugador y mismo tipo, inmediatamente
 * antes (por fecha y, a igual fecha, por creación). Solo trae esa evaluación.
 */
export async function obtenerAnterior(
  ctx: ContextoEscuela,
  ev: Pick<EvaluacionCompleta, "id" | "tipo" | "fecha" | "createdAt" | "jugador">,
): Promise<Resultado<{ fecha: string; puntuaciones: { competenciaId: string; puntuacion: Nota }[] } | null>> {
  const { data, error } = await ctx.supabase
    .from("evaluaciones")
    .select("id, fecha, evaluacion_puntuaciones(competencia_id, puntuacion)")
    .eq("escuela_id", ctx.escuelaId)
    .eq("jugador_id", ev.jugador.id)
    .eq("tipo", ev.tipo)
    .neq("id", ev.id)
    // Valores entre comillas: la marca de tiempo lleva «.» y «:» (reservados en PostgREST).
    .or(`fecha.lt."${ev.fecha}",and(fecha.eq."${ev.fecha}",created_at.lt."${ev.createdAt}")`)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    registrar("evaluación anterior", error);
    return { ok: false, mensaje: ERROR_LECTURA };
  }
  if (!data) return { ok: true, datos: null };
  const notas = (Array.isArray(data.evaluacion_puntuaciones) ? data.evaluacion_puntuaciones : []) as { competencia_id: string; puntuacion: Nota }[];
  return {
    ok: true,
    datos: { fecha: data.fecha as string, puntuaciones: notas.map((n) => ({ competenciaId: n.competencia_id, puntuacion: n.puntuacion })) },
  };
}

/** Nombre visible de un miembro (null si no lo tiene o no es visible para el usuario). */
export async function nombreVisible(ctx: ContextoEscuela, usuarioId: string | null): Promise<string | null> {
  if (!usuarioId) return null;
  const { data, error } = await ctx.supabase.from("perfiles").select("nombre_visible").eq("id", usuarioId).maybeSingle();
  if (error) registrar("perfil", error);
  return (data?.nombre_visible as string | null | undefined) ?? null;
}

/**
 * Datos del informe de una evaluación, SOLO a partir de lo guardado en
 * Supabase. null si la evaluación no existe o es de otra escuela.
 */
export async function obtenerInforme(
  ctx: ContextoEscuela,
  id: string,
): Promise<Resultado<{ informe: InformeEvaluacion; evaluacion: EvaluacionCompleta } | null>> {
  const r = await obtenerEvaluacion(ctx, id);
  if (!r.ok) return r;
  if (!r.datos) return { ok: true, datos: null };
  const ev = r.datos;
  const [anterior, entrenador] = await Promise.all([obtenerAnterior(ctx, ev), nombreVisible(ctx, ev.entrenadorId)]);
  if (!anterior.ok) return anterior;
  return {
    ok: true,
    datos: {
      evaluacion: ev,
      informe: {
      escuela: ctx.escuelaNombre,
      jugador: { nombre: ev.jugador.nombre, nivel: ev.jugador.nivel },
      grupo: ev.grupo?.nombre ?? null,
      entrenador,
      tipo: ev.tipo,
      titulo: ev.titulo,
      fecha: ev.fecha,
      puntuaciones: ev.puntuaciones,
      media: media(ev.puntuaciones),
      fortalezas: ev.fortalezas,
      mejoras: ev.mejoras,
      observaciones: ev.observaciones,
      objetivos: ev.objetivos,
      comparacion: compararEvaluaciones(ev.puntuaciones, anterior.datos),
      hayAnterior: anterior.datos !== null,
      emitido: hoyIso(),
      },
    },
  };
}
