"use client";

import { createBrowserClient } from "@supabase/ssr";
import { configSupabase } from "@/lib/supabase/config";

/**
 * Cliente de Supabase para Client Components (usa solo la clave PÚBLICA).
 * Aún no se usa: el inicio de sesión va por Server Actions. Queda preparado
 * para funciones de navegador (p. ej. tiempo real) en fases posteriores.
 * RLS protege los datos igualmente: esta clave no da acceso por sí sola.
 */
export function crearClienteNavegador() {
  const config = configSupabase();
  if (!config.ok) throw new Error(config.motivo);
  return createBrowserClient(config.config.url, config.config.clavePublica);
}
