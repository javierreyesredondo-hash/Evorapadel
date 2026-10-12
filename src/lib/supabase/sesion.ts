import "server-only";
import { cache } from "react";
import { esErrorDeEsquema, normalizarMembresias, type Membresia } from "@/lib/acceso";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// Capa de acceso a datos (DAL) de la sesión. Es la ÚNICA fuente de verdad
// sobre quién es el usuario y a qué escuela pertenece: nunca se acepta un
// escuela_id que venga del navegador. RLS limita además lo que devuelve la
// base de datos a las escuelas del propio usuario.

export type Sesion =
  | { estado: "sin_configurar" }
  | { estado: "sin_sesion" }
  | { estado: "error"; esquema: boolean }
  | {
      estado: "ok";
      usuarioId: string;
      email: string | null;
      nombreVisible: string | null;
      membresias: Membresia[];
    };

/** Sesión del usuario actual (una consulta por petición gracias a cache()). */
export const obtenerSesion = cache(async (): Promise<Sesion> => {
  const supabase = await crearClienteServidor();
  if (!supabase) return { estado: "sin_configurar" };

  // getUser() valida el token contra el servidor de Auth (detecta sesiones revocadas).
  const { data: usuario, error: errorUsuario } = await supabase.auth.getUser();
  if (errorUsuario || !usuario.user) return { estado: "sin_sesion" };
  const usuarioId = usuario.user.id;

  const consultar = () =>
    Promise.all([
      supabase
        .from("membresias")
        .select("rol, escuela:escuelas!inner(id, nombre)")
        // Filtro por el id VERIFICADO del servidor; RLS lo aplicaría igualmente.
        .eq("usuario_id", usuarioId),
      supabase.from("perfiles").select("nombre_visible").eq("id", usuarioId).maybeSingle(),
    ]);

  let [membresias, perfil] = await consultar();
  // Justo después de iniciar sesión, PostgREST puede rechazar el token recién
  // emitido («JWT issued at future», PGRST303) si su reloj va un segundo por
  // detrás del de Auth. Se reintenta una sola vez.
  if (esTokenDelFuturo(membresias.error) || esTokenDelFuturo(perfil.error)) {
    await new Promise((r) => setTimeout(r, 1100));
    [membresias, perfil] = await consultar();
  }

  if (membresias.error || perfil.error) {
    const error = membresias.error ?? perfil.error;
    console.error("ÉVORA PADEL: error al leer la sesión", error?.code, error?.message);
    return { estado: "error", esquema: esErrorDeEsquema(error) };
  }

  return {
    estado: "ok",
    usuarioId,
    email: usuario.user.email ?? null,
    nombreVisible: (perfil.data?.nombre_visible as string | null | undefined) ?? null,
    membresias: normalizarMembresias(membresias.data),
  };
});

function esTokenDelFuturo(error: { code?: string; message?: string } | null) {
  return error?.code === "PGRST303" && /future/i.test(error.message ?? "");
}
