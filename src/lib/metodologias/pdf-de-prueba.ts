// SOLO PARA PRUEBAS (unitarias y E2E): genera PDF sintéticos de metodología
// con pdf-lib. El contenido es inventado («Método Sintético»); nunca se usan
// documentos reales en las pruebas ni en el repositorio.
//
// Fuente: Liberation Sans de pdfjs-dist (licencia SIL OFL), que incluye «□»
// para las casillas y está disponible también en CI.

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

// Desde la raíz del proyecto (sin import.meta: Playwright carga este archivo como CommonJS).
const requerir = createRequire(join(process.cwd(), "package.json"));
const fuentes = join(dirname(requerir.resolve("pdfjs-dist/package.json")), "standard_fonts");

/** Imagen PNG de 1 × 1 píxel (se escala para ocupar la página). */
const PNG_1PX = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);

export type Texto = { t: string; x: number; y: number; tam?: number; negrita?: boolean };
export type PaginaDePrueba = { textos: Texto[]; imagenCompleta?: boolean; ancho?: number; alto?: number };

export async function pdfDePrueba(paginas: PaginaDePrueba[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const normal = await doc.embedFont(readFileSync(join(fuentes, "LiberationSans-Regular.ttf")), { subset: true });
  const negrita = await doc.embedFont(readFileSync(join(fuentes, "LiberationSans-Bold.ttf")), { subset: true });
  const png = await doc.embedPng(PNG_1PX);
  for (const p of paginas) {
    const pagina: PDFPage = doc.addPage([p.ancho ?? 900, p.alto ?? 1200]);
    if (p.imagenCompleta) pagina.drawImage(png, { x: 0, y: 0, width: pagina.getWidth(), height: pagina.getHeight() });
    for (const t of p.textos) {
      const fuente: PDFFont = t.negrita ? negrita : normal;
      pagina.drawText(t.t, { x: t.x, y: t.y, size: t.tam ?? 12, font: fuente, color: rgb(0.06, 0.1, 0.17) });
    }
  }
  return doc.save();
}

/**
 * Metodología sintética con los mismos tipos de elementos que un método real:
 * portada con versión, fases numeradas, tabla de principios, escala 1–5,
 * criterios, una ficha de evaluación (tabla 1–5, escalas, opciones, lista,
 * campos) y una página con una imagen (texto no extraíble).
 */
/** `version` cambia el documento (y su huella): las pruebas E2E importan versiones distintas. */
export async function metodologiaSintetica(version = "2.3"): Promise<Uint8Array> {
  const C = 12;
  return pdfDePrueba([
    {
      textos: [
        { t: `V${version} · DOCUMENTO DE PRUEBA`, x: 60, y: 1100, tam: 9 },
        { t: "MÉTODO SINTÉTICO", x: 60, y: 1040, tam: 32 },
        { t: "Un método inventado para las pruebas.", x: 60, y: 990, tam: C },
      ],
    },
    {
      textos: [
        { t: "La idea", x: 60, y: 1100, tam: 32 },
        { t: "Texto de introducción sintético.", x: 60, y: 1060, tam: C },
        { t: "01", x: 60, y: 1010, tam: C },
        { t: "OBSERVAR", x: 60, y: 985, tam: 16 },
        { t: "Mirar con atención sintética.", x: 60, y: 962, tam: C },
        { t: "02", x: 60, y: 920, tam: C },
        { t: "MEDIR", x: 60, y: 895, tam: 16 },
        { t: "Contar lo que pasa.", x: 60, y: 872, tam: C },
        { t: "Los principios", x: 60, y: 800, tam: 24 },
        { t: "Nº", x: 70, y: 760, tam: C, negrita: true },
        { t: "Principio", x: 200, y: 760, tam: C, negrita: true },
        { t: "Qué significa", x: 500, y: 760, tam: C, negrita: true },
        { t: "01", x: 70, y: 730, tam: C },
        { t: "Primero el jugador", x: 200, y: 730, tam: C },
        { t: "La clase se adapta.", x: 500, y: 730, tam: C },
        { t: "02", x: 70, y: 700, tam: C },
        { t: "Con intención", x: 200, y: 700, tam: C },
        { t: "Cada tarea responde a algo.", x: 500, y: 700, tam: C },
      ],
    },
    {
      textos: [
        { t: "Escala 1–5", x: 60, y: 1100, tam: 32 },
        ...["INICIAL", "EN DESARROLLO", "FUNCIONAL", "AVANZADO", "DOMINIO"].flatMap((n, i) => [
          { t: `${i + 1} • ${n}`, x: 100, y: 1040 - i * 60, tam: 16 },
          { t: `Descripción sintética del nivel ${i + 1}.`, x: 100, y: 1018 - i * 60, tam: C },
        ]),
        { t: "Criterios específicos", x: 60, y: 700, tam: 24 },
        { t: "COMPETENCIA", x: 70, y: 660, tam: C, negrita: true },
        { t: "QUÉ OBSERVAMOS", x: 400, y: 660, tam: C, negrita: true },
        { t: "Técnica", x: 70, y: 630, tam: C },
        { t: "Golpea con control.", x: 400, y: 630, tam: C },
        { t: "Paciencia", x: 70, y: 600, tam: C },
        { t: "Sabe esperar.", x: 400, y: 600, tam: C },
      ],
    },
    {
      textos: [
        { t: "FICHA 01 · EVALUACIÓN INICIAL", x: 60, y: 1100, tam: 32 },
        { t: "A. TÉCNICA", x: 60, y: 1050, tam: 24 },
        { t: "ELEMENTO", x: 70, y: 1010, tam: C, negrita: true },
        { t: "1–5", x: 260, y: 1010, tam: C, negrita: true },
        { t: "OBSERVACIÓN", x: 460, y: 1010, tam: C, negrita: true },
        { t: "Derecha", x: 70, y: 980, tam: C },
        { t: "—", x: 260, y: 980, tam: C },
        { t: "_____", x: 460, y: 980, tam: C },
        { t: "Globo", x: 70, y: 950, tam: C },
        { t: "—", x: 260, y: 950, tam: C },
        { t: "_____", x: 460, y: 950, tam: C },
        { t: "B. DEFENSA", x: 60, y: 890, tam: 24 },
        { t: "Pared: 1 2 3 4 5", x: 60, y: 850, tam: C },
        { t: "Globo: 1 2 3 4 5", x: 300, y: 850, tam: C },
        { t: "C. DESPLAZAMIENTO", x: 60, y: 790, tam: 24 },
        { t: "Posición de espera: _____", x: 60, y: 750, tam: C },
        { t: "Llegada a la bola: _____", x: 60, y: 720, tam: C },
        { t: "DIAGNÓSTICO", x: 60, y: 660, tam: 16 },
        { t: "Principal limitación: _____", x: 60, y: 630, tam: C },
        { t: "□ Técnica □ Táctica □ Mixta", x: 60, y: 600, tam: C },
        { t: "FORTALEZAS", x: 60, y: 550, tam: 16 },
        { t: "1: _____", x: 60, y: 520, tam: C },
        { t: "2: _____", x: 60, y: 490, tam: C },
        { t: "Nota: es una hipótesis.", x: 60, y: 450, tam: C },
      ],
    },
    { imagenCompleta: true, textos: [{ t: "Mapa del método", x: 60, y: 1100, tam: 32 }] },
  ]);
}
