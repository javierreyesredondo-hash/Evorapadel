import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { configSupabase } from "@/lib/supabase/config";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 * Crea uno nuevo en cada petición (nunca compartirlo entre usuarios).
 * Devuelve null si falta la configuración: la app falla cerrada.
 */
export async function crearClienteServidor() {
  // La sesión es dato de petición: nada de esto puede prerenderizarse.
  // (auth-js usa Date.now() al cargar la sesión; sin connection() Next 16 lo
  // detecta como valor inestable durante el prerenderizado.)
  await connection();
  const config = configSupabase();
  if (!config.ok) return null;
  const almacen = await cookies();
  return createServerClient(config.config.url, config.config.clavePublica, {
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (lista) => {
        try {
          for (const { name, value, options } of lista) almacen.set(name, value, options);
        } catch {
          // Desde un Server Component no se pueden escribir cookies; el Proxy
          // (src/proxy.ts) ya refresca la sesión en cada petición.
        }
      },
    },
  });
}
