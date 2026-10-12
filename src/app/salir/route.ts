import { NextResponse, type NextRequest } from "next/server";
import { RUTA_ACCESO } from "@/lib/acceso";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// Cerrar sesión con un POST de formulario normal (no una Server Action): el
// navegador carga /acceso desde cero y descarta todo lo que la app tenía en
// memoria, incluida la caché del router con pantallas privadas. Con una Server
// Action, Next volvía a precargar los enlaces de la página ya sin sesión.
export async function POST(request: NextRequest) {
  // Solo formularios de la propia app. (Las cookies de sesión son SameSite=Lax:
  // un POST desde otro sitio tampoco las llevaría.)
  const origen = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origen && new URL(origen).host !== host) {
    return new NextResponse(null, { status: 403 });
  }

  const supabase = await crearClienteServidor();
  // «local»: cierra la sesión de este navegador. La opción por defecto
  // («global») cerraría también la de todos los demás dispositivos del usuario.
  await supabase?.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL(RUTA_ACCESO, request.url), 303);
}
