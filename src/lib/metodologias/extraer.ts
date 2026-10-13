// Extracción del texto de un PDF con pdf.js, en el servidor (Node). No se envía
// a ningún servicio externo y no guarda el archivo: solo devuelve líneas
// posicionadas y cuánto ocupan las imágenes de cada página.
//
// Seguridad: pdfjs-dist 6.3.289 (corrige GHSA-hq66-cqwq-w95j, ejecución de
// JavaScript al abrir un PDF malicioso; la v6 ya no evalúa código al
// interpretar fuentes). Solo se lee texto: sin capa de anotaciones ni
// scripting, sin fuentes del sistema y sin descargas.
//
// Los errores se lanzan como ErrorPdf con un mensaje comprensible; nunca
// incluyen el contenido del documento.

import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { construirLineas, type FragmentoTexto } from "./lineas.ts";
import type { PaginaExtraida } from "./analizar.ts";
import { LIMITES_IMPORTACION } from "./modelo.ts";

export class ErrorPdf extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorPdf";
  }
}

const NEGRITA = /bold|black|heavy|semibold|extrabold/i;

/** ¿Empieza como un PDF? («%PDF-» en los primeros bytes). */
export function pareceUnPdf(bytes: Uint8Array): boolean {
  const cabecera = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  return cabecera.includes("%PDF-");
}

export async function extraerPaginas(bytes: Uint8Array): Promise<PaginaExtraida[]> {
  if (bytes.length === 0) throw new ErrorPdf("El archivo está vacío.");
  if (bytes.length > LIMITES_IMPORTACION.pdfBytes) throw new ErrorPdf("El PDF supera el tamaño máximo (4 MB).");
  if (!pareceUnPdf(bytes)) throw new ErrorPdf("El archivo no es un PDF válido.");

  const tarea = getDocument({
    // Copia: pdf.js se queda con el búfer que recibe.
    data: new Uint8Array(bytes),
    disableFontFace: true,
    useSystemFonts: false,
    disableAutoFetch: true,
    stopAtErrors: false,
    verbosity: 0,
  });
  let doc;
  try {
    doc = await tarea.promise;
  } catch (e) {
    await tarea.destroy();
    const nombre = (e as Error)?.name ?? "";
    if (nombre === "PasswordException") throw new ErrorPdf("El PDF está protegido con contraseña: guarda una copia sin protección y vuelve a intentarlo.");
    throw new ErrorPdf("No se ha podido abrir el PDF: puede estar dañado.");
  }

  try {
    if (doc.numPages > LIMITES_IMPORTACION.pdfPaginas)
      throw new ErrorPdf(`El PDF tiene ${doc.numPages} páginas: el máximo es ${LIMITES_IMPORTACION.pdfPaginas}.`);
    const paginas: PaginaExtraida[] = [];
    let fragmentosTotales = 0;
    for (let n = 1; n <= doc.numPages; n++) {
      const pagina = await doc.getPage(n);
      const operaciones = await pagina.getOperatorList();
      const contenido = await pagina.getTextContent();
      fragmentosTotales += contenido.items.length;
      if (fragmentosTotales > 30_000) throw new ErrorPdf("El PDF tiene demasiado texto para importarlo como metodología.");

      const negrita = new Map<string, boolean>();
      const esNegrita = (nombreFuente: string) => {
        if (!negrita.has(nombreFuente)) {
          let valor = false;
          try {
            const fuente = pagina.commonObjs.get(nombreFuente) as { name?: string; bold?: boolean } | undefined;
            valor = fuente?.bold === true || NEGRITA.test(fuente?.name ?? "");
          } catch {
            valor = false;
          }
          negrita.set(nombreFuente, valor);
        }
        return negrita.get(nombreFuente)!;
      };

      const fragmentos: FragmentoTexto[] = [];
      for (const item of contenido.items) {
        if (!("str" in item)) continue;
        const [, , , d, x, y] = item.transform as number[];
        fragmentos.push({
          texto: item.str,
          x,
          y,
          ancho: item.width,
          tam: Math.abs(d) || item.height,
          negrita: esNegrita(item.fontName),
          finDeLinea: item.hasEOL,
        });
      }
      const vista = pagina.getViewport({ scale: 1 });
      paginas.push({
        numero: n,
        lineas: construirLineas(fragmentos),
        fraccionImagen: fraccionImagenes(operaciones, vista.width * vista.height),
      });
      pagina.cleanup();
    }
    if (paginas.every((p) => p.lineas.length === 0))
      throw new ErrorPdf("El PDF no tiene texto que se pueda extraer (parece escaneado o hecho de imágenes). Esta versión no hace OCR: usa un PDF exportado con texto.");
    return paginas;
  } finally {
    await tarea.destroy();
  }
}

type Matriz = [number, number, number, number, number, number];
const multiplicar = (m: Matriz, n: Matriz): Matriz => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

/** Superficie de la página cubierta por imágenes (0–1), siguiendo la matriz de transformación. */
export function fraccionImagenes(operaciones: { fnArray: number[]; argsArray: unknown[] }, areaPagina: number): number {
  let ctm: Matriz = [1, 0, 0, 1, 0, 0];
  const pila: Matriz[] = [];
  let area = 0;
  for (let k = 0; k < operaciones.fnArray.length; k++) {
    const op = operaciones.fnArray[k];
    const args = operaciones.argsArray[k] as unknown[] | null;
    if (op === OPS.save) pila.push(ctm);
    else if (op === OPS.restore) ctm = pila.pop() ?? ctm;
    else if (op === OPS.transform && args) ctm = multiplicar(ctm, args as Matriz);
    else if (op === OPS.paintFormXObjectBegin) {
      pila.push(ctm);
      const matriz = args?.[0];
      if (Array.isArray(matriz) && matriz.length === 6) ctm = multiplicar(ctm, matriz as Matriz);
    } else if (op === OPS.paintFormXObjectEnd) ctm = pila.pop() ?? ctm;
    else if (op === OPS.paintImageXObject || op === OPS.paintInlineImageXObject || op === OPS.paintImageMaskXObject)
      area += Math.abs(ctm[0] * ctm[3] - ctm[1] * ctm[2]);
  }
  return areaPagina > 0 ? Math.min(1, area / areaPagina) : 0;
}
