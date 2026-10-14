"use server";

import { refresh } from "next/cache";
import type { EstadoFormulario, ResultadoAccion } from "@/app/acciones-gestion";
import { hoyIso } from "@/lib/format";
import { esUuid, limpiarTexto, mensajeErrorBD } from "@/lib/gestion";
import { LIMITES_EVALUACION, validarCompetencia, validarEvaluacion } from "@/lib/evaluaciones";
import { METODOLOGIA_BASE } from "@/lib/metodologia";
import { validarPropuestaGuardada } from "@/lib/redaccion";
import { listarCompetencias, obtenerEvaluacion, puedeEditar, type EvaluacionCompleta } from "@/lib/supabase/evaluaciones";
import { contextoEscuela } from "@/lib/supabase/gestion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { obtenerSesion } from "@/lib/supabase/sesion";

// Escrituras de evaluaciones, metodología y perfil.
//
// Seguridad (igual que acciones-gestion.ts):
//   * La escuela sale de la sesión verificada (contextoEscuela), nunca del
//     formulario. El autor de una evaluación lo pone la base de datos.
//   * Jugador, grupo, competencias y evaluación se comprueban contra la escuela
//     activa antes de guardar; RLS, las FK compuestas y los triggers lo imponen
//     de nuevo en la base de datos.
//   * Los mensajes no distinguen «no existe» de «es de otra escuela».

const SIN_ESCUELA = "No se ha podido identificar tu escuela. Recarga la página o vuelve a iniciar sesión.";
const NO_ENCONTRADA = "No se ha encontrado la evaluación en tu escuela.";
const SOLO_DIRECCION = "Solo la dirección de la escuela puede cambiar la metodología.";

/** Todos los campos de texto del formulario, para devolverlos si hay errores. */
function valoresDe(datos: FormData): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const [clave, valor] of datos) if (typeof valor === "string" && clave !== "clave_envio" && !clave.startsWith("$")) valores[clave] = valor;
  return valores;
}

const texto = (datos: FormData, campo: string) => {
  const v = datos.get(campo);
  return typeof v === "string" ? v : "";
};

// -------------------------------------------------------------- evaluaciones

export async function guardarEvaluacion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const ctx = await contextoEscuela();
  if (!ctx) return { error: SIN_ESCUELA, valores };

  const id = texto(datos, "id");
  const editando = id !== "";
  let existente: EvaluacionCompleta | null = null;
  let jugadorId: string;

  if (editando) {
    if (!esUuid(id)) return { error: NO_ENCONTRADA, valores };
    const r = await obtenerEvaluacion(ctx, id);
    if (!r.ok) return { error: r.mensaje, valores };
    if (!r.datos) return { error: NO_ENCONTRADA, valores };
    if (!puedeEditar(ctx, r.datos)) return { error: "Solo quien hizo la evaluación o la dirección pueden editarla.", valores };
    existente = r.datos;
    jugadorId = existente.jugador.id;
  } else {
    jugadorId = texto(datos, "jugador");
    if (!esUuid(jugadorId)) return { errores: { jugador: "Elige un jugador." }, valores };
    const { data: jugador, error } = await ctx.supabase
      .from("jugadores")
      .select("id, activo")
      .eq("id", jugadorId)
      .eq("escuela_id", ctx.escuelaId)
      .maybeSingle();
    if (error) return { error: mensajeErrorBD(error), valores };
    if (!jugador) return { errores: { jugador: "Elige un jugador de tu escuela." }, valores };
    if (!jugador.activo) return { errores: { jugador: "No se puede evaluar a un jugador archivado." }, valores };
  }

  // Competencias que se pueden puntuar: las activas y, al editar, las que ya tenía.
  const competencias = await listarCompetencias(ctx);
  if (!competencias.ok) return { error: competencias.mensaje, valores };
  const previas = new Set(existente?.puntuaciones.map((p) => p.competenciaId) ?? []);
  const permitidas = competencias.datos.filter((c) => c.activa || previas.has(c.id));
  if (permitidas.length === 0) return { error: "Tu escuela todavía no tiene metodología: la dirección debe definir las competencias.", valores };

  const v = validarEvaluacion(
    {
      tipo: datos.get("tipo"),
      fecha: datos.get("fecha"),
      titulo: datos.get("titulo"),
      grupoId: datos.get("grupo"),
      fortalezas: datos.get("fortalezas"),
      mejoras: datos.get("mejoras"),
      interpretacion: datos.get("interpretacion"),
      observaciones: datos.get("observaciones"),
      notas: Object.fromEntries(permitidas.map((c) => [c.id, datos.get(`nota_${c.id}`)])),
      objetivos: Array.from({ length: LIMITES_EVALUACION.objetivos }, (_, i) => ({
        descripcion: datos.get(`objetivo_${i}`),
        plazo: datos.get(`plazo_${i}`),
      })),
    },
    permitidas,
    hoyIso(),
  );
  if (!v.ok) return { errores: v.errores, valores };

  // El grupo debe ser uno del jugador (salvo que no cambie al editar: histórico).
  const grupoId = v.valor.grupoId;
  if (grupoId && grupoId !== existente?.grupo?.id) {
    const { data, error } = await ctx.supabase
      .from("grupo_jugadores")
      .select("grupo_id")
      .eq("escuela_id", ctx.escuelaId)
      .eq("grupo_id", grupoId)
      .eq("jugador_id", jugadorId)
      .maybeSingle();
    if (error) return { error: mensajeErrorBD(error), valores };
    if (!data) return { errores: { grupo: "El jugador no pertenece a ese grupo." }, valores };
  }

  const clave = texto(datos, "clave_envio");
  if (!editando && !esUuid(clave)) return { error: "No se ha podido preparar el envío. Recarga la página e inténtalo de nuevo.", valores };

  const { data, error } = await ctx.supabase.rpc("guardar_evaluacion", {
    p_escuela: ctx.escuelaId,
    p_id: editando ? id : null,
    p_clave_envio: editando ? null : clave,
    p_jugador: editando ? null : jugadorId,
    p_grupo: grupoId,
    p_tipo: v.valor.tipo,
    p_fecha: v.valor.fecha,
    p_titulo: v.valor.titulo,
    p_fortalezas: v.valor.fortalezas,
    p_mejoras: v.valor.mejoras,
    p_observaciones: v.valor.observaciones,
    p_puntuaciones: v.valor.puntuaciones,
    p_objetivos: v.valor.objetivos,
    p_interpretacion: v.valor.interpretacion,
    p_propuesta: propuestaDe(texto(datos, "propuesta")),
  });
  if (error) {
    console.error("ÉVORA PADEL: error al guardar una evaluación", error.code, error.message);
    if (error.code === "P0002") return { error: NO_ENCONTRADA, valores };
    if (error.code === "23514" && /grupo/i.test(error.message)) return { errores: { grupo: "El jugador no pertenece a ese grupo." }, valores };
    if (error.code === "23503") return { error: "Alguna competencia, el jugador o el grupo ya no están disponibles en tu escuela. Recarga la página.", valores };
    return { error: mensajeErrorBD(error), valores };
  }
  return { ok: true, id: data as string, mensaje: editando ? "Evaluación actualizada." : "Evaluación guardada." };
}

/** Propuesta automática que se mostró (JSON del formulario), validada; null si no hay. */
function propuestaDe(json: string): ReturnType<typeof validarPropuestaGuardada> {
  if (!json || json.length > 12_000) return null;
  try {
    return validarPropuestaGuardada(JSON.parse(json));
  } catch {
    return null;
  }
}

// --------------------------------------------------- evaluación en cadena

export type EntradaCadena = {
  grupoId: string;
  jugadorId: string;
  /** Identificador del envío: el mismo en los reintentos (no duplica). */
  clave: string;
  notas: Record<string, string>;
  observaciones: string;
  objetivo: string;
  fortalezas: string;
  mejoras: string;
  interpretacion: string;
  /** Propuesta automática mostrada (JSON), para distinguirla de lo editado. */
  propuesta: string;
};

export type ResultadoCadena =
  | { ok: true; id: string }
  | { ok: false; error: string; errores?: Record<string, string>; existente?: { id: string } };

/**
 * Guarda la evaluación de un jugador en la evaluación en cadena de un grupo
 * (hoy, en ese grupo). Si el jugador ya tiene una de hoy en el grupo, NO crea
 * otra: devuelve la existente para verla o editarla. Un reintento con la misma
 * clave devuelve la evaluación ya guardada (no duplica).
 */
export async function guardarEvaluacionCadena(entrada: EntradaCadena): Promise<ResultadoCadena> {
  const ctx = await contextoEscuela();
  if (!ctx) return { ok: false, error: SIN_ESCUELA };
  if (typeof entrada !== "object" || entrada === null) return { ok: false, error: "No se ha recibido la evaluación." };
  const { grupoId, jugadorId, clave } = entrada;
  if (!esUuid(grupoId) || !esUuid(jugadorId)) return { ok: false, error: "Elige un jugador del grupo." };
  if (!esUuid(clave)) return { ok: false, error: "No se ha podido preparar el envío. Recarga la página e inténtalo de nuevo." };

  // El jugador debe estar activo y en ese grupo de la escuela.
  const { data: asignado, error: errorGrupo } = await ctx.supabase
    .from("grupo_jugadores")
    .select("jugador:jugadores(id, activo)")
    .eq("escuela_id", ctx.escuelaId)
    .eq("grupo_id", grupoId)
    .eq("jugador_id", jugadorId)
    .maybeSingle();
  if (errorGrupo) return { ok: false, error: mensajeErrorBD(errorGrupo) };
  const jugador = Array.isArray(asignado?.jugador) ? asignado.jugador[0] : asignado?.jugador;
  if (!jugador) return { ok: false, error: "El jugador no pertenece a este grupo." };
  if (!(jugador as { activo: boolean }).activo) return { ok: false, error: "No se puede evaluar a un jugador archivado." };

  const competencias = await listarCompetencias(ctx);
  if (!competencias.ok) return { ok: false, error: competencias.mensaje };
  const activas = competencias.datos.filter((c) => c.activa);
  if (activas.length === 0) return { ok: false, error: "Tu escuela todavía no tiene metodología: la dirección debe definir las competencias." };

  const hoy = hoyIso();
  const notas = typeof entrada.notas === "object" && entrada.notas !== null ? entrada.notas : {};
  const todas = activas.every((c) => /^[1-5]$/.test(String(notas[c.id] ?? "")));
  const v = validarEvaluacion(
    {
      tipo: todas ? "completa" : "rapida",
      fecha: hoy,
      titulo: "",
      grupoId,
      fortalezas: entrada.fortalezas,
      mejoras: entrada.mejoras,
      interpretacion: entrada.interpretacion,
      observaciones: entrada.observaciones,
      notas,
      objetivos: [{ descripcion: entrada.objetivo, plazo: "" }],
    },
    activas,
    hoy,
  );
  if (!v.ok) {
    const primero = Object.values(v.errores)[0];
    return { ok: false, error: v.errores.notas ?? primero ?? "Revisa la evaluación.", errores: v.errores };
  }

  // ¿Ya hay una de hoy para este jugador en este grupo (de otro envío)? No se
  // crea otra ni se sobrescribe: se ofrece verla o editarla.
  const { data: previa, error: errorPrevia } = await ctx.supabase
    .from("evaluaciones")
    .select("id")
    .eq("escuela_id", ctx.escuelaId)
    .eq("jugador_id", jugadorId)
    .eq("grupo_id", grupoId)
    .eq("fecha", hoy)
    .or(`clave_envio.is.null,clave_envio.neq.${clave}`)
    .limit(1)
    .maybeSingle();
  if (errorPrevia) return { ok: false, error: mensajeErrorBD(errorPrevia) };
  if (previa) return { ok: false, error: "Este jugador ya tiene una evaluación de hoy en este grupo.", existente: { id: previa.id as string } };

  const { data, error } = await ctx.supabase.rpc("guardar_evaluacion", {
    p_escuela: ctx.escuelaId,
    p_id: null,
    p_clave_envio: clave,
    p_jugador: jugadorId,
    p_grupo: grupoId,
    p_tipo: v.valor.tipo,
    p_fecha: v.valor.fecha,
    p_titulo: null,
    p_fortalezas: v.valor.fortalezas,
    p_mejoras: v.valor.mejoras,
    p_observaciones: v.valor.observaciones,
    p_puntuaciones: v.valor.puntuaciones,
    p_objetivos: v.valor.objetivos,
    p_interpretacion: v.valor.interpretacion,
    p_propuesta: propuestaDe(typeof entrada.propuesta === "string" ? entrada.propuesta : ""),
  });
  if (error) {
    console.error("ÉVORA PADEL: error al guardar una evaluación en cadena", error.code, error.message);
    if (error.code === "23514") return { ok: false, error: "El jugador no pertenece a este grupo." };
    if (error.code === "23503") return { ok: false, error: "Alguna competencia ya no está disponible. Recarga la página." };
    return { ok: false, error: mensajeErrorBD(error) };
  }
  return { ok: true, id: data as string };
}

// --------------------------------------------------------------- metodología

export async function guardarCompetencia(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const ctx = await contextoEscuela();
  if (!ctx) return { error: SIN_ESCUELA, valores };
  if (ctx.rol !== "director") return { error: SOLO_DIRECCION, valores };

  const id = texto(datos, "id");
  if (id !== "" && !esUuid(id)) return { error: "No se ha encontrado la competencia.", valores };
  const v = validarCompetencia({
    nombre: datos.get("nombre"),
    area: datos.get("area"),
    descripcion: datos.get("descripcion"),
    orden: datos.get("orden"),
    activa: datos.get("activa"),
  });
  if (!v.ok) return { errores: v.errores, valores };

  const consulta =
    id === ""
      ? ctx.supabase.from("competencias").insert({ escuela_id: ctx.escuelaId, ...v.valor }).select("id")
      : ctx.supabase.from("competencias").update(v.valor).eq("id", id).eq("escuela_id", ctx.escuelaId).select("id");
  const { data, error } = await consulta;
  if (error?.code === "23505") return { errores: { nombre: "Ya existe una competencia con ese nombre en tu escuela." }, valores };
  // 22023: la base de datos protege las competencias de una metodología importada.
  if (error?.code === "22023") return { error: "Las competencias de una metodología importada no se editan: importa una versión nueva.", valores };
  if (error) return { error: mensajeErrorBD(error), valores };
  if (!data?.length) return { error: "No se ha encontrado la competencia.", valores };
  refresh();
  return { ok: true, id: data[0].id as string, mensaje: id === "" ? "Competencia añadida." : "Competencia guardada." };
}

/** Activa o desactiva una competencia (no se borran: las evaluaciones antiguas las usan). */
export async function cambiarEstadoCompetencia(id: string, activa: boolean): Promise<ResultadoAccion> {
  const ctx = await contextoEscuela();
  if (!ctx) return { ok: false, error: SIN_ESCUELA };
  if (ctx.rol !== "director") return { ok: false, error: SOLO_DIRECCION };
  if (!esUuid(id) || typeof activa !== "boolean") return { ok: false, error: "No se ha encontrado la competencia." };
  const { data, error } = await ctx.supabase.from("competencias").update({ activa }).eq("id", id).eq("escuela_id", ctx.escuelaId).select("id");
  if (error) return { ok: false, error: mensajeErrorBD(error) };
  if (!data?.length) return { ok: false, error: "No se ha encontrado la competencia." };
  refresh();
  return { ok: true, mensaje: activa ? "Competencia activada." : "Competencia desactivada." };
}

/** Carga la metodología base ÉVORA en una escuela que todavía no tiene ninguna. */
export async function cargarMetodologiaBase(): Promise<ResultadoAccion> {
  const ctx = await contextoEscuela();
  if (!ctx) return { ok: false, error: SIN_ESCUELA };
  if (ctx.rol !== "director") return { ok: false, error: SOLO_DIRECCION };
  const existentes = await listarCompetencias(ctx);
  if (!existentes.ok) return { ok: false, error: existentes.mensaje };
  if (existentes.datos.length > 0) return { ok: false, error: "Tu escuela ya tiene competencias: edítalas o añade otras." };

  const { error } = await ctx.supabase
    .from("competencias")
    .insert(METODOLOGIA_BASE.map((c, i) => ({ escuela_id: ctx.escuelaId, ...c, orden: i + 1 })));
  // 23505: otro envío simultáneo ya la cargó (la inserción múltiple es atómica).
  if (error && error.code !== "23505") return { ok: false, error: mensajeErrorBD(error) };
  refresh();
  return { ok: true, mensaje: "Metodología base cargada. Puedes adaptarla a tu escuela." };
}

// -------------------------------------------------------------------- perfil

/** Nombre visible del propio usuario (aparece como entrenador/a en los informes). */
export async function guardarPerfil(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const sesion = await obtenerSesion();
  if (sesion.estado !== "ok") return { error: "Vuelve a iniciar sesión.", valores };
  const nombre = limpiarTexto(datos.get("nombre_visible"));
  if (nombre.length > 120) return { errores: { nombre_visible: "Máximo 120 caracteres." }, valores };
  const supabase = await crearClienteServidor();
  if (!supabase) return { error: SIN_ESCUELA, valores };
  // RLS (perfiles_editar_propio) solo deja editar el propio perfil.
  const { data, error } = await supabase
    .from("perfiles")
    .update({ nombre_visible: nombre === "" ? null : nombre })
    .eq("id", sesion.usuarioId)
    .select("id");
  if (error) return { error: mensajeErrorBD(error), valores };
  if (!data?.length) return { error: "No se ha podido guardar tu perfil.", valores };
  refresh();
  return { ok: true, id: sesion.usuarioId, mensaje: "Nombre guardado." };
}
