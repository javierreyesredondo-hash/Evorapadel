import "server-only";
import { esUuid } from "@/lib/gestion";
import { escalaDe, type Escala } from "@/lib/metodologia";
import type { ContenidoMetodologia } from "@/lib/metodologias/modelo";
import type { ContextoEscuela, Resultado } from "@/lib/supabase/gestion";

// Lecturas de las metodologías importadas de la escuela activa. Como en el
// resto de la app: la escuela sale de la sesión verificada y RLS lo impone en
// la base de datos. Los errores se registran sin contenido.

const ERROR_LECTURA = "No se han podido cargar las metodologías. Vuelve a intentarlo en unos minutos.";

function registrar(origen: string, error: { code?: string; message?: string } | null) {
  console.error(`ÉVORA PADEL: error al leer ${origen}`, error?.code, error?.message);
}

export type EstadoMetodologia = "borrador" | "activa" | "archivada";

export type ResumenMetodologia = {
  id: string;
  nombre: string;
  version: string;
  estado: EstadoMetodologia;
  creada: string;
  activada: string | null;
  documento: { nombre: string; paginas: number | null } | null;
};

export type MetodologiaGuardada = ResumenMetodologia & { descripcion: string | null; contenido: ContenidoMetodologia };

const SELECT_RESUMEN = "id, nombre, version, estado, created_at, activada_at, documento_nombre, documento_paginas";

function aResumen(f: Record<string, unknown>): ResumenMetodologia {
  return {
    id: f.id as string,
    nombre: f.nombre as string,
    version: f.version as string,
    estado: f.estado as EstadoMetodologia,
    creada: f.created_at as string,
    activada: (f.activada_at as string | null) ?? null,
    documento: f.documento_nombre ? { nombre: f.documento_nombre as string, paginas: (f.documento_paginas as number | null) ?? null } : null,
  };
}

export async function listarMetodologias(ctx: ContextoEscuela): Promise<Resultado<ResumenMetodologia[]>> {
  const { data, error } = await ctx.supabase
    .from("metodologias")
    .select(SELECT_RESUMEN)
    .eq("escuela_id", ctx.escuelaId)
    .order("created_at", { ascending: false });
  if (error) {
    registrar("metodologías", error);
    return { ok: false, mensaje: ERROR_LECTURA };
  }
  return { ok: true, datos: (data ?? []).map((f) => aResumen(f as Record<string, unknown>)) };
}

/** Metodología de la escuela activa, o null si no existe o es de otra escuela (mismo resultado). */
export async function obtenerMetodologia(ctx: ContextoEscuela, id: string): Promise<Resultado<MetodologiaGuardada | null>> {
  if (!esUuid(id)) return { ok: true, datos: null };
  const { data, error } = await ctx.supabase
    .from("metodologias")
    .select(`${SELECT_RESUMEN}, descripcion, contenido`)
    .eq("escuela_id", ctx.escuelaId)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    registrar("metodología", error);
    return { ok: false, mensaje: ERROR_LECTURA };
  }
  if (!data) return { ok: true, datos: null };
  const f = data as Record<string, unknown>;
  return {
    ok: true,
    datos: { ...aResumen(f), descripcion: (f.descripcion as string | null) ?? null, contenido: f.contenido as ContenidoMetodologia },
  };
}

/** Metodología activa (para la escala de las evaluaciones nuevas), o null. */
export async function metodologiaActiva(
  ctx: ContextoEscuela,
): Promise<Resultado<{ id: string; nombre: string; version: string; escala: Escala } | null>> {
  const { data, error } = await ctx.supabase
    .from("metodologias")
    .select("id, nombre, version, escala:contenido->escala")
    .eq("escuela_id", ctx.escuelaId)
    .eq("estado", "activa")
    .maybeSingle();
  if (error) {
    registrar("metodología activa", error);
    return { ok: false, mensaje: ERROR_LECTURA };
  }
  if (!data) return { ok: true, datos: null };
  return { ok: true, datos: { id: data.id as string, nombre: data.nombre as string, version: data.version as string, escala: escalaDe(data.escala) } };
}

/** ¿Ya se importó este PDF en la escuela? (misma huella SHA-256) */
export async function buscarPorHuella(ctx: ContextoEscuela, sha256: string): Promise<{ id: string; nombre: string; version: string } | null> {
  const { data, error } = await ctx.supabase
    .from("metodologias")
    .select("id, nombre, version")
    .eq("escuela_id", ctx.escuelaId)
    .eq("documento_sha256", sha256)
    .maybeSingle();
  if (error) registrar("huella de metodología", error);
  return data ? { id: data.id as string, nombre: data.nombre as string, version: data.version as string } : null;
}
