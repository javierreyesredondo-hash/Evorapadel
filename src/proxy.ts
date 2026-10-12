import { NextResponse, type NextRequest } from "next/server";
import { esRutaPublica, RUTA_ACCESO, RUTA_SALIR } from "@/lib/acceso";
import { esFichaExistente } from "@/lib/rutas";
import { actualizarSesion, conSesion } from "@/lib/supabase/proxy";

// Proxy (antes «middleware») de Next 16. Se ejecuta antes de renderizar:
//
// 1. Refresca la sesión de Supabase y la escribe en las cookies (obligatorio
//    con @supabase/ssr; los Server Components no pueden escribir cookies).
// 2. Comprobación OPTIMISTA de acceso: sin sesión, toda ruta privada redirige
//    a /acceso. Es solo el primer filtro: la zona privada vuelve a comprobar la
//    sesión en el servidor (src/lib/supabase/sesion.ts) antes de mostrar nada.
// 3. Fichas de jugadores inexistentes → 404 real (con Cache Components el
//    notFound() de la página llegaba tarde y el código era 200).

/** Ruta que no existe en la app: Next la resuelve con not-found.tsx y estado 404. */
const RUTA_NO_ENCONTRADA = "/_no-encontrado";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const { respuesta, usuarioId } = await actualizarSesion(request);

  // /salir cierra la sesión haya o no sesión; nunca se redirige.
  if (pathname === RUTA_SALIR) return respuesta;

  if (!usuarioId && !esRutaPublica(pathname)) {
    const destino = new URL(RUTA_ACCESO, request.url);
    if (pathname !== "/") destino.searchParams.set("siguiente", `${pathname}${search}`);
    return conSesion(NextResponse.redirect(destino), respuesta);
  }

  if (usuarioId && esRutaPublica(pathname)) {
    return conSesion(NextResponse.redirect(new URL("/", request.url)), respuesta);
  }

  if (pathname.startsWith("/jugadores/") && !esFichaExistente(pathname)) {
    return conSesion(NextResponse.rewrite(new URL(RUTA_NO_ENCONTRADA, request.url)), respuesta);
  }

  return respuesta;
}

export const config = {
  // Todo salvo los recursos estáticos (Next, iconos e imágenes).
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
