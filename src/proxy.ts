import { NextResponse, type NextRequest } from "next/server";
import { esFichaExistente } from "@/lib/rutas";

// Fichas de jugadores inexistentes → 404 real.
//
// Con Cache Components, /jugadores/[id] se sirve con prerenderizado parcial:
// la respuesta empieza a enviarse (con 200) antes de que la página llegue a
// llamar a notFound(), así que el 404 solo era visual. La documentación de
// Next 16 indica comprobar el identificador en Proxy, antes de renderizar
// (file-conventions/loading → «Status codes»; functions/not-found).
//
// La comprobación es barata: compara con la lista fija de jugadores ficticios.
// Cuando haya base de datos habrá que revisarla (Proxy debe ser rápido).

/** Ruta que no existe en la app: Next la resuelve con not-found.tsx y estado 404. */
const RUTA_NO_ENCONTRADA = "/_no-encontrado";

export function proxy(request: NextRequest) {
  if (esFichaExistente(request.nextUrl.pathname)) return NextResponse.next();
  return NextResponse.rewrite(new URL(RUTA_NO_ENCONTRADA, request.url));
}

export const config = {
  // Solo la ficha (un segmento). /jugadores y rutas más profundas no pasan por aquí.
  matcher: "/jugadores/:id",
};
