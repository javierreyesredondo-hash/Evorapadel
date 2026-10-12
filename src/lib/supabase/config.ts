import { validarConfigSupabase, type ResultadoConfig } from "@/lib/acceso";

/**
 * Configuración pública de Supabase (URL + clave publishable/anon).
 * Las referencias literales a process.env.NEXT_PUBLIC_* permiten que Next las
 * incluya en el navegador. NUNCA añadir aquí la clave secreta/service_role:
 * validarConfigSupabase la rechaza.
 */
export function configSupabase(): ResultadoConfig {
  return validarConfigSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
