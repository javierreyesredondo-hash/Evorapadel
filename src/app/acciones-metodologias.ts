"use server";

import { refresh } from "next/cache";
import type { ResultadoAccion } from "@/app/acciones-gestion";
import { esUuid, mensajeErrorBD } from "@/lib/gestion";
import { validarPropuesta } from "@/lib/metodologias/modelo";
import { contextoEscuela } from "@/lib/supabase/gestion";

// Metodologías importadas: guardar la propuesta revisada (como BORRADOR),
// activarla y archivar borradores. Separado de la extracción del PDF
// (metodologia/importar/analizar): aquí nunca llega el documento, solo la
// propuesta revisada, que se valida de nuevo por completo.
//
// Seguridad: solo la dirección (y RLS lo impone). La escuela sale de la sesión.
// Activar no toca evaluaciones anteriores (lo garantizan los triggers de la
// migración 4). Nada se borra.

const SIN_ESCUELA = "No se ha podido identificar tu escuela. Recarga la página o vuelve a iniciar sesión.";
const SOLO_DIRECCION = "Solo la dirección de la escuela puede importar o activar metodologías.";
const NO_ENCONTRADA = "No se ha encontrado la metodología en tu escuela.";
const MAX_ENVIO = 600_000;

export type ResultadoGuardado = { ok: true; id: string } | { ok: false; errores: string[] };

/** Guarda la propuesta revisada como borrador (no la activa). */
export async function guardarMetodologiaImportada(propuestaJson: string, documentoJson: string): Promise<ResultadoGuardado> {
  const ctx = await contextoEscuela();
  if (!ctx) return { ok: false, errores: [SIN_ESCUELA] };
  if (ctx.rol !== "director") return { ok: false, errores: [SOLO_DIRECCION] };
  if (typeof propuestaJson !== "string" || typeof documentoJson !== "string" || propuestaJson.length + documentoJson.length > MAX_ENVIO)
    return { ok: false, errores: ["La metodología es demasiado grande: descarta elementos que no necesites."] };

  let propuesta: unknown;
  let documento: unknown;
  try {
    propuesta = JSON.parse(propuestaJson);
    documento = documentoJson ? JSON.parse(documentoJson) : null;
  } catch {
    return { ok: false, errores: ["La propuesta no tiene el formato esperado. Vuelve a analizar el PDF."] };
  }
  const v = validarPropuesta(propuesta, documento);
  if (!v.ok) return { ok: false, errores: v.errores };
  const { nombre, version, descripcion, contenido, documento: doc } = v.valor;

  const { data, error } = await ctx.supabase
    .from("metodologias")
    .insert({
      escuela_id: ctx.escuelaId,
      nombre,
      version,
      descripcion,
      contenido,
      documento_nombre: doc?.nombre ?? null,
      documento_sha256: doc?.sha256 ?? null,
      documento_bytes: doc?.bytes ?? null,
      documento_paginas: doc?.paginas ?? null,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      const porDocumento = /documento/.test(`${error.message} ${error.details ?? ""}`);
      return {
        ok: false,
        errores: [
          porDocumento
            ? "Este PDF ya está importado en tu escuela. Si es una versión nueva, exporta el PDF actualizado."
            : `Ya existe «${nombre}» versión ${version}: cambia la versión para guardarla como una nueva.`,
        ],
      };
    }
    console.error("ÉVORA PADEL: error al guardar una metodología", error.code);
    return { ok: false, errores: [mensajeErrorBD(error)] };
  }
  refresh();
  return { ok: true, id: data.id as string };
}

/**
 * Activa una metodología: archiva la que estuviera activa y sus competencias
 * evaluables pasan a pedirse en las evaluaciones nuevas (base de datos).
 */
export async function activarMetodologia(id: string): Promise<ResultadoAccion> {
  const ctx = await contextoEscuela();
  if (!ctx) return { ok: false, error: SIN_ESCUELA };
  if (ctx.rol !== "director") return { ok: false, error: SOLO_DIRECCION };
  if (!esUuid(id)) return { ok: false, error: NO_ENCONTRADA };
  const { data, error } = await ctx.supabase
    .from("metodologias")
    .update({ estado: "activa" })
    .eq("id", id)
    .eq("escuela_id", ctx.escuelaId)
    .neq("estado", "activa")
    .select("id");
  if (error) {
    // 22023: regla de la base de datos con mensaje propio (p. ej. sin competencias evaluables).
    if (error.code === "22023" && error.message) return { ok: false, error: error.message };
    return { ok: false, error: mensajeErrorBD(error) };
  }
  if (!data?.length) return { ok: false, error: "No se ha encontrado la metodología o ya está activa." };
  refresh();
  return { ok: true, mensaje: "Metodología activada. Las evaluaciones nuevas usarán sus competencias y su escala." };
}

/** Archiva un borrador que no se va a usar (no se borra). */
export async function archivarMetodologia(id: string): Promise<ResultadoAccion> {
  const ctx = await contextoEscuela();
  if (!ctx) return { ok: false, error: SIN_ESCUELA };
  if (ctx.rol !== "director") return { ok: false, error: SOLO_DIRECCION };
  if (!esUuid(id)) return { ok: false, error: NO_ENCONTRADA };
  const { data, error } = await ctx.supabase
    .from("metodologias")
    .update({ estado: "archivada" })
    .eq("id", id)
    .eq("escuela_id", ctx.escuelaId)
    .eq("estado", "borrador")
    .select("id");
  if (error) return { ok: false, error: mensajeErrorBD(error) };
  if (!data?.length) return { ok: false, error: "Solo se pueden archivar los borradores." };
  refresh();
  return { ok: true, mensaje: "Borrador archivado." };
}
