import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/** Texto y número de páginas de un PDF (para comprobar lo que realmente contiene). */
export async function leerPdf(bytes: Buffer | Uint8Array): Promise<{ paginas: number; texto: string }> {
  const doc = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: false }).promise;
  const partes: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const contenido = await (await doc.getPage(n)).getTextContent();
    partes.push(contenido.items.map((i) => ("str" in i ? i.str : "")).join(" "));
  }
  await doc.destroy();
  // Espacios normalizados: pdf.js puede partir una línea en varios trozos.
  return { paginas: doc.numPages, texto: partes.join("\n").replace(/\s+/g, " ") };
}
