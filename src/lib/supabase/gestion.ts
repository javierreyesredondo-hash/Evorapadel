import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Rol } from "@/lib/acceso";
import {
  esUuid,
  normalizarGrupo,
  normalizarJugador,
  type GrupoReal,
  type JugadorReal,
  type Miembro,
} from "@/lib/gestion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { obtenerSesion } from "@/lib/supabase/sesion";

// Lecturas de jugadores y grupos REALES de la escuela del usuario.
//
// La escuela SIEMPRE sale de la membresía del usuario verificado en el
// servidor (obtenerSesion → getUser), nunca de un dato del navegador. Todas las
// consultas filtran además por esa escuela_id, y RLS lo impone en la base de
// datos: aunque un filtro faltara, no se verían filas de otras escuelas.

export type ContextoEscuela = {
  supabase: SupabaseClient;
  usuarioId: string;
  escuelaId: string;
  escuelaNombre: string;
  rol: Rol;
};

export type Resultado<T> = { ok: true; datos: T } | { ok: false; mensaje: string };

const ERROR_LECTURA = "No se han podido cargar los datos de tu escuela. Vuelve a intentarlo en unos minutos.";

/**
 * Escuela activa del usuario: la primera de sus membresías por nombre, la misma
 * que muestra la barra «Tu escuela». null sin sesión, sin escuela o sin conexión.
 */
export const contextoEscuela = cache(async (): Promise<ContextoEscuela | null> => {
  const sesion = await obtenerSesion();
  if (sesion.estado !== "ok") return null;
  const activa = sesion.membresias[0];
  if (!activa) return null;
  const supabase = await crearClienteServidor();
  if (!supabase) return null;
  return {
    supabase,
    usuarioId: sesion.usuarioId,
    escuelaId: activa.escuelaId,
    escuelaNombre: activa.escuelaNombre,
    rol: activa.rol,
  };
});

export const SELECT_JUGADOR =
  "id, nombre, fecha_nacimiento, mano, nivel, posicion, foco, activo, grupo_jugadores(grupo:grupos(id, nombre))";
const SELECT_GRUPO = "id, nombre, entrenador_id, grupo_jugadores(jugador:jugadores(id, nombre, activo))";

function registrar(origen: string, error: { code?: string; message?: string } | null) {
  console.error(`ÉVORA PADEL: error al leer ${origen}`, error?.code, error?.message);
}

export async function listarJugadores(ctx: ContextoEscuela): Promise<Resultado<JugadorReal[]>> {
  const { data, error } = await ctx.supabase
    .from("jugadores")
    .select(SELECT_JUGADOR)
    .eq("escuela_id", ctx.escuelaId)
    .order("nombre");
  if (error) {
    registrar("jugadores", error);
    return { ok: false, mensaje: ERROR_LECTURA };
  }
  return { ok: true, datos: (data ?? []).map((f) => normalizarJugador(f as Record<string, unknown>)) };
}

/** Jugador de la escuela activa, o null si no existe o es de otra escuela (mismo resultado). */
export async function obtenerJugador(ctx: ContextoEscuela, id: string): Promise<Resultado<JugadorReal | null>> {
  if (!esUuid(id)) return { ok: true, datos: null };
  const { data, error } = await ctx.supabase
    .from("jugadores")
    .select(SELECT_JUGADOR)
    .eq("escuela_id", ctx.escuelaId)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    registrar("jugador", error);
    return { ok: false, mensaje: ERROR_LECTURA };
  }
  return { ok: true, datos: data ? normalizarJugador(data as Record<string, unknown>) : null };
}

export async function listarGrupos(ctx: ContextoEscuela): Promise<Resultado<GrupoReal[]>> {
  const { data, error } = await ctx.supabase
    .from("grupos")
    .select(SELECT_GRUPO)
    .eq("escuela_id", ctx.escuelaId)
    .order("nombre");
  if (error) {
    registrar("grupos", error);
    return { ok: false, mensaje: ERROR_LECTURA };
  }
  return { ok: true, datos: (data ?? []).map((f) => normalizarGrupo(f as Record<string, unknown>)) };
}

export async function obtenerGrupo(ctx: ContextoEscuela, id: string): Promise<Resultado<GrupoReal | null>> {
  if (!esUuid(id)) return { ok: true, datos: null };
  const { data, error } = await ctx.supabase
    .from("grupos")
    .select(SELECT_GRUPO)
    .eq("escuela_id", ctx.escuelaId)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    registrar("grupo", error);
    return { ok: false, mensaje: ERROR_LECTURA };
  }
  return { ok: true, datos: data ? normalizarGrupo(data as Record<string, unknown>) : null };
}

/** Miembros de la escuela activa (posibles entrenadores de un grupo). */
export async function listarMiembros(ctx: ContextoEscuela): Promise<Resultado<Miembro[]>> {
  const { data, error } = await ctx.supabase
    .from("membresias")
    .select("usuario_id, rol, perfil:perfiles(nombre_visible)")
    .eq("escuela_id", ctx.escuelaId);
  if (error) {
    registrar("miembros", error);
    return { ok: false, mensaje: ERROR_LECTURA };
  }
  const miembros = (data ?? []).map((f) => {
    const perfil = (Array.isArray(f.perfil) ? f.perfil[0] : f.perfil) as { nombre_visible?: string | null } | null;
    return { usuarioId: String(f.usuario_id), rol: f.rol as Rol, nombre: perfil?.nombre_visible ?? null };
  });
  miembros.sort((a, b) => (a.rol === b.rol ? (a.nombre ?? "").localeCompare(b.nombre ?? "", "es") : a.rol === "director" ? -1 : 1));
  return { ok: true, datos: miembros };
}
