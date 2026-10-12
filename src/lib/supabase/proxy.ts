import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { configSupabase } from "@/lib/supabase/config";

export type EstadoSesionProxy = {
  /** Respuesta con las cookies de sesión refrescadas (devolverla o copiar sus cookies). */
  respuesta: NextResponse;
  usuarioId: string | null;
  configurado: boolean;
};

/**
 * Refresca la sesión de Supabase en cada petición (patrón oficial de
 * @supabase/ssr) y devuelve el usuario verificado. getClaims() valida la
 * firma del JWT (o consulta al servidor de Auth si la firma es simétrica).
 */
export async function actualizarSesion(request: NextRequest): Promise<EstadoSesionProxy> {
  let respuesta = NextResponse.next({ request });
  const config = configSupabase();
  if (!config.ok) return { respuesta, usuarioId: null, configurado: false };

  const supabase = createServerClient(config.config.url, config.config.clavePublica, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista, cabeceras) => {
        for (const { name, value } of lista) request.cookies.set(name, value);
        respuesta = NextResponse.next({ request });
        for (const { name, value, options } of lista) respuesta.cookies.set(name, value, options);
        // Cabeceras anti-caché: una CDN nunca debe guardar la sesión de un usuario.
        for (const [clave, valor] of Object.entries(cabeceras ?? {})) respuesta.headers.set(clave, valor);
      },
    },
  });

  // No poner código entre la creación del cliente y getClaims(): puede
  // provocar cierres de sesión aleatorios (advertencia de @supabase/ssr).
  const { data, error } = await supabase.auth.getClaims();
  const usuarioId = !error && typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  return { respuesta, usuarioId, configurado: true };
}

/** Copia las cookies (y cabeceras anti-caché) de la sesión a otra respuesta. */
export function conSesion(destino: NextResponse, origen: NextResponse): NextResponse {
  for (const cookie of origen.cookies.getAll()) destino.cookies.set(cookie);
  const cache = origen.headers.get("cache-control");
  if (cache) destino.headers.set("cache-control", cache);
  return destino;
}
