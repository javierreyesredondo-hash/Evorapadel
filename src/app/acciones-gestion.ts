"use server";

import { refresh } from "next/cache";
import { hoyIso } from "@/lib/format";
import {
  buscarHomonimo,
  esUuid,
  mensajeErrorBD,
  validarGrupo,
  validarJugador,
} from "@/lib/gestion";
import { contextoEscuela, listarMiembros } from "@/lib/supabase/gestion";

// Escrituras REALES de jugadores, grupos y asignaciones.
//
// Seguridad:
//   * La escuela sale de contextoEscuela() (membresía del usuario verificado en
//     el servidor). Ningún formulario envía escuela_id, y si lo enviara se ignora.
//   * Los id de jugador/grupo del navegador solo identifican la fila; todas las
//     escrituras filtran también por la escuela activa.
//   * RLS es la autoridad final: estas comprobaciones solo dan mensajes claros.

export type EstadoFormulario = {
  ok?: boolean;
  id?: string;
  mensaje?: string;
  /** Error general (sin campo concreto). */
  error?: string;
  errores?: Record<string, string>;
  /** Lo que escribió el usuario, para no perderlo si hay errores. */
  valores?: Record<string, string>;
  /** Nombre del jugador existente con el mismo nombre (pide confirmación). */
  homonimo?: string;
};

export type ResultadoAccion = { ok: true; mensaje: string } | { ok: false; error: string };

const SIN_ESCUELA = "No se ha podido identificar tu escuela. Recarga la página o vuelve a iniciar sesión.";
const SOLO_DIRECCION = "Solo la dirección de la escuela puede crear o editar grupos.";
const GRUPO_DUPLICADO = "Ya existe un grupo con ese nombre en tu escuela.";

const CAMPOS_JUGADOR = ["nombre", "fecha_nacimiento", "mano", "nivel", "posicion", "foco"] as const;
const CAMPOS_GRUPO = ["nombre", "entrenador_id"] as const;

function leer(datos: FormData, campos: readonly string[]): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const c of campos) {
    const v = datos.get(c);
    valores[c] = typeof v === "string" ? v : "";
  }
  return valores;
}

// ------------------------------------------------------------------ jugadores

async function guardarJugador(datos: FormData, id: string | null): Promise<EstadoFormulario> {
  const valores = leer(datos, CAMPOS_JUGADOR);
  const ctx = await contextoEscuela();
  if (!ctx) return { error: SIN_ESCUELA, valores };
  if (id !== null && !esUuid(id)) return { error: "No se ha encontrado el jugador en tu escuela.", valores };

  const r = validarJugador(valores, hoyIso());
  if (!r.ok) return { errores: r.errores, valores };

  // Evita duplicados por error (doble envío, alta repetida). Si de verdad son
  // dos personas con el mismo nombre, el usuario lo confirma.
  if (datos.get("confirmar_homonimo") !== "si") {
    const { data, error } = await ctx.supabase.from("jugadores").select("id, nombre").eq("escuela_id", ctx.escuelaId);
    if (error) return { error: mensajeErrorBD(error), valores };
    const homonimo = buscarHomonimo(data ?? [], r.valor.nombre, id ?? undefined);
    if (homonimo) {
      return {
        valores,
        homonimo: homonimo.nombre,
        errores: { nombre: `Ya hay un jugador llamado «${homonimo.nombre}» en tu escuela.` },
      };
    }
  }

  if (id === null) {
    const { data, error } = await ctx.supabase
      .from("jugadores")
      .insert({ escuela_id: ctx.escuelaId, ...r.valor })
      .select("id")
      .single();
    if (error) return { error: mensajeErrorBD(error), valores };
    return { ok: true, id: data.id as string, mensaje: "Jugador creado." };
  }

  const { data, error } = await ctx.supabase
    .from("jugadores")
    .update(r.valor)
    .eq("id", id)
    .eq("escuela_id", ctx.escuelaId)
    .select("id");
  if (error) return { error: mensajeErrorBD(error), valores };
  // 0 filas: no existe, es de otra escuela o RLS no deja editarlo.
  if (!data?.length) return { error: "No se ha encontrado el jugador en tu escuela.", valores };
  return { ok: true, id, mensaje: "Cambios guardados." };
}

export async function crearJugador(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  return guardarJugador(datos, null);
}

export async function actualizarJugador(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const id = datos.get("id");
  return guardarJugador(datos, typeof id === "string" ? id : "");
}

/** Archiva (activo = false) o reactiva un jugador. No se borra nada. */
export async function cambiarEstadoJugador(id: string, activo: boolean): Promise<ResultadoAccion> {
  const ctx = await contextoEscuela();
  if (!ctx) return { ok: false, error: SIN_ESCUELA };
  if (!esUuid(id) || typeof activo !== "boolean") return { ok: false, error: "No se ha encontrado el jugador en tu escuela." };

  const { data, error } = await ctx.supabase
    .from("jugadores")
    .update({ activo })
    .eq("id", id)
    .eq("escuela_id", ctx.escuelaId)
    .select("id");
  if (error) return { ok: false, error: mensajeErrorBD(error) };
  if (!data?.length) return { ok: false, error: "No se ha encontrado el jugador en tu escuela." };
  refresh();
  return { ok: true, mensaje: activo ? "Jugador reactivado." : "Jugador archivado." };
}

// --------------------------------------------------------------------- grupos

async function guardarGrupo(datos: FormData, id: string | null): Promise<EstadoFormulario> {
  const valores = leer(datos, CAMPOS_GRUPO);
  const ctx = await contextoEscuela();
  if (!ctx) return { error: SIN_ESCUELA, valores };
  // RLS solo permite a la dirección crear y editar grupos.
  if (ctx.rol !== "director") return { error: SOLO_DIRECCION, valores };
  if (id !== null && !esUuid(id)) return { error: "No se ha encontrado el grupo en tu escuela.", valores };

  const miembros = await listarMiembros(ctx);
  if (!miembros.ok) return { error: miembros.mensaje, valores };
  const r = validarGrupo(valores, new Set(miembros.datos.map((m) => m.usuarioId)));
  if (!r.ok) return { errores: r.errores, valores };

  if (id === null) {
    const { data, error } = await ctx.supabase
      .from("grupos")
      .insert({ escuela_id: ctx.escuelaId, ...r.valor })
      .select("id")
      .single();
    if (error?.code === "23505") return { errores: { nombre: GRUPO_DUPLICADO }, valores };
    if (error) return { error: mensajeErrorBD(error), valores };
    return { ok: true, id: data.id as string, mensaje: "Grupo creado." };
  }

  const { data, error } = await ctx.supabase
    .from("grupos")
    .update(r.valor)
    .eq("id", id)
    .eq("escuela_id", ctx.escuelaId)
    .select("id");
  if (error?.code === "23505") return { errores: { nombre: GRUPO_DUPLICADO }, valores };
  if (error) return { error: mensajeErrorBD(error), valores };
  if (!data?.length) return { error: "No se ha encontrado el grupo en tu escuela.", valores };
  return { ok: true, id, mensaje: "Cambios guardados." };
}

export async function crearGrupo(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  return guardarGrupo(datos, null);
}

export async function actualizarGrupo(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const id = datos.get("id");
  return guardarGrupo(datos, typeof id === "string" ? id : "");
}

// --------------------------------------------------------------- asignaciones

/** Añade un jugador activo a un grupo. Repetirlo no duplica nada. */
export async function asignarJugador(grupoId: string, jugadorId: string): Promise<ResultadoAccion> {
  const ctx = await contextoEscuela();
  if (!ctx) return { ok: false, error: SIN_ESCUELA };
  if (!esUuid(grupoId) || !esUuid(jugadorId)) return { ok: false, error: "Elige un jugador y un grupo de tu escuela." };

  const { data: jugador, error: errorJugador } = await ctx.supabase
    .from("jugadores")
    .select("id, activo")
    .eq("id", jugadorId)
    .eq("escuela_id", ctx.escuelaId)
    .maybeSingle();
  if (errorJugador) return { ok: false, error: mensajeErrorBD(errorJugador) };
  if (!jugador) return { ok: false, error: "No se ha encontrado el jugador en tu escuela." };
  if (!jugador.activo) return { ok: false, error: "No se puede añadir a un grupo un jugador archivado." };

  // Las FK compuestas (escuela_id, grupo_id) y (escuela_id, jugador_id) impiden
  // en la base de datos mezclar escuelas aunque fallara todo lo demás.
  const { error } = await ctx.supabase
    .from("grupo_jugadores")
    .insert({ escuela_id: ctx.escuelaId, grupo_id: grupoId, jugador_id: jugadorId });
  if (error?.code === "23505") {
    refresh();
    return { ok: true, mensaje: "El jugador ya estaba en el grupo." };
  }
  if (error?.code === "23503") return { ok: false, error: "No se ha encontrado el grupo en tu escuela." };
  if (error) return { ok: false, error: mensajeErrorBD(error) };
  refresh();
  return { ok: true, mensaje: "Jugador añadido al grupo." };
}

/** Quita un jugador de un grupo. Repetirlo no da error. */
export async function desasignarJugador(grupoId: string, jugadorId: string): Promise<ResultadoAccion> {
  const ctx = await contextoEscuela();
  if (!ctx) return { ok: false, error: SIN_ESCUELA };
  if (!esUuid(grupoId) || !esUuid(jugadorId)) return { ok: false, error: "Elige un jugador y un grupo de tu escuela." };

  const { data, error } = await ctx.supabase
    .from("grupo_jugadores")
    .delete()
    .eq("grupo_id", grupoId)
    .eq("jugador_id", jugadorId)
    .eq("escuela_id", ctx.escuelaId)
    .select("jugador_id");
  if (error) return { ok: false, error: mensajeErrorBD(error) };
  refresh();
  return { ok: true, mensaje: data?.length ? "Jugador quitado del grupo." : "El jugador ya no estaba en el grupo." };
}
