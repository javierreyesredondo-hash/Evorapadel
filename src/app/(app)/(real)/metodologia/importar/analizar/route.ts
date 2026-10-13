import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { analizarDocumento } from "@/lib/metodologias/analizar";
import { ErrorPdf, extraerPaginas } from "@/lib/metodologias/extraer";
import { LIMITES_IMPORTACION, limpiar } from "@/lib/metodologias/modelo";
import { contextoEscuela } from "@/lib/supabase/gestion";
import { buscarPorHuella } from "@/lib/supabase/metodologias";

// Analiza un PDF de metodología y devuelve una PROPUESTA para revisar. No guarda
// nada: ni el archivo (solo se calcula su huella SHA-256 para detectar
// duplicados) ni la propuesta, que se guarda después, revisada, con
// guardarMetodologiaImportada. No se envía a servicios externos y nunca se
// registra el contenido del documento.
//
// Acceso: sesión (proxy y aquí) y solo la dirección de la escuela.

const SIN_CACHE = { "Cache-Control": "private, no-store, max-age=0" };
const TIEMPO_MAXIMO_MS = 20_000;

/** Host de la cabecera Origin («null» o mal formada → null: se rechaza). */
function hostDe(origen: string): string | null {
  try {
    return new URL(origen).host;
  } catch {
    return null;
  }
}

const error = (status: number, mensaje: string) => Response.json({ error: mensaje }, { status, headers: SIN_CACHE });

export async function POST(request: NextRequest) {
  // Solo formularios de la propia app (como /salir).
  const origen = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origen && hostDe(origen) !== host) return error(403, "Origen no permitido.");

  const ctx = await contextoEscuela();
  if (!ctx) return error(401, "Inicia sesión para importar una metodología.");
  if (ctx.rol !== "director") return error(403, "Solo la dirección de la escuela puede importar metodologías.");

  // Límite antes de leer el cuerpo (el PDF más el sobre del formulario).
  const longitud = Number(request.headers.get("content-length") ?? "0");
  if (longitud > LIMITES_IMPORTACION.pdfBytes + 64 * 1024) return error(413, "El PDF supera el tamaño máximo (4 MB).");

  let archivo: FormDataEntryValue | null;
  try {
    archivo = (await request.formData()).get("archivo");
  } catch {
    return error(400, "No se ha recibido ningún archivo.");
  }
  if (!(archivo instanceof File)) return error(400, "Elige un archivo PDF.");
  if (archivo.size === 0) return error(400, "El archivo está vacío.");
  if (archivo.size > LIMITES_IMPORTACION.pdfBytes) return error(413, "El PDF supera el tamaño máximo (4 MB).");
  if (archivo.type !== "application/pdf" && !/\.pdf$/i.test(archivo.name)) return error(415, "Elige un archivo PDF.");

  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  try {
    const paginas = await Promise.race([
      extraerPaginas(bytes),
      new Promise<never>((_, rechazar) => setTimeout(() => rechazar(new ErrorPdf("El PDF ha tardado demasiado en analizarse. Prueba con un documento más sencillo.")), TIEMPO_MAXIMO_MS)),
    ]);
    const propuesta = analizarDocumento(paginas);
    const duplicado = await buscarPorHuella(ctx, sha256);
    return Response.json(
      {
        propuesta,
        documento: { nombre: limpiar(archivo.name, 200) || "metodologia.pdf", bytes: bytes.length, paginas: paginas.length, sha256 },
        duplicado,
      },
      { headers: SIN_CACHE },
    );
  } catch (e) {
    if (e instanceof ErrorPdf) return error(422, e.message);
    // Sin contenido del documento en el registro.
    console.error("ÉVORA PADEL: error al analizar un PDF de metodología", (e as Error)?.name);
    return error(500, "No se ha podido analizar el PDF. Inténtalo de nuevo.");
  }
}
