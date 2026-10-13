import { nombreArchivoInforme } from "@/lib/evaluaciones";
import { cargarFuentes } from "@/lib/pdf/fuentes";
import { generarPdfInforme } from "@/lib/pdf/informe-pdf";
import { obtenerInforme } from "@/lib/supabase/evaluaciones";
import { contextoEscuela } from "@/lib/supabase/gestion";

// PDF del informe de una evaluación, generado en cada petición a partir de los
// datos guardados en Supabase (no se almacena en ningún sitio).
//
// Acceso: el proxy exige sesión; aquí se vuelve a comprobar la sesión y la
// escuela activa, y RLS impide leer evaluaciones de otras escuelas. «No existe»
// y «es de otra escuela» dan la misma respuesta 404. Nunca se cachea.

const SIN_CACHE = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request, ctxRuta: RouteContext<"/evaluaciones/[id]/pdf">) {
  const { id } = await ctxRuta.params;
  const ctx = await contextoEscuela();
  if (!ctx) return new Response("Inicia sesión para ver este informe.", { status: 401, headers: SIN_CACHE });

  const r = await obtenerInforme(ctx, id);
  if (!r.ok) return new Response("No se ha podido cargar la evaluación.", { status: 503, headers: SIN_CACHE });
  if (!r.datos) return new Response("Informe no encontrado.", { status: 404, headers: SIN_CACHE });

  try {
    const { bytes } = await generarPdfInforme(r.datos.informe, await cargarFuentes());
    const nombre = nombreArchivoInforme(r.datos.informe.jugador.nombre, r.datos.informe.fecha);
    const disposicion = new URL(request.url).searchParams.has("descargar") ? "attachment" : "inline";
    return new Response(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" }), {
      headers: {
        ...SIN_CACHE,
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposicion}; filename="${nombre}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
        "Content-Length": String(bytes.byteLength),
      },
    });
  } catch (e) {
    // Sin datos personales en el registro (el mensaje podría incluir texto del informe).
    console.error("ÉVORA PADEL: error al generar un informe PDF", (e as Error).name);
    return new Response("No se ha podido generar el PDF.", { status: 500, headers: SIN_CACHE });
  }
}
