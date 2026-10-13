// Genera el PDF del informe de una evaluación con pdf-lib (JavaScript puro,
// sin navegador ni servicios externos). Maqueta a mano con medidas reales de
// las fuentes: ajusta líneas, corta páginas sin partir filas y numera páginas.
//
// Devuelve también `trazas` (cada texto dibujado con su posición) para que las
// pruebas comprueben que nada se sale de la página ni se superpone.

import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { textoFecha } from "../format.ts";
import { NIVEL_TEXTO, type NivelBD } from "../gestion.ts";
import { textoDiferencia, textoMediaEvaluacion, TIPO_TEXTO } from "../evaluaciones.ts";
import { TEXTO_SIN_ENTRENADOR, textoSinComparacion, type InformeEvaluacion } from "../informe.ts";
import { AREA_TEXTO, ESCALA_NOTAS } from "../metodologia.ts";
import type { BytesFuente, FuentesInforme } from "./fuentes.ts";

// ------------------------------------------------------------------ medidas
export const PAGINA = { ancho: 595.28, alto: 841.89 } as const; // A4
export const MARGEN = { x: 44, inferior: 70, superiorContinuacion: 34 + 26 } as const;
const ANCHO_UTIL = PAGINA.ancho - 2 * MARGEN.x;
const ALTO_CABECERA = 108;

const color = (r: number, g: number, b: number) => rgb(r / 255, g / 255, b / 255);
const C = {
  noche: color(16, 27, 44),
  verde: color(199, 255, 50),
  naranja: color(255, 130, 76),
  blanco: color(255, 255, 255),
  texto: color(30, 39, 51),
  tenue: color(91, 107, 130),
  tenueClaro: color(169, 180, 198),
  linea: color(213, 220, 230),
  suave: color(242, 245, 249),
  vacio: color(227, 232, 239),
};

export type Traza = { pagina: number; x: number; y: number; ancho: number; alto: number; texto: string; zona: "cabecera" | "cuerpo" | "pie" };

// --------------------------------------------- fuente con latín + latín ext.
class Fuente {
  private readonly principal: PDFFont;
  private readonly extra: PDFFont;
  private readonly cubiertos: Set<number>;
  private readonly cubiertosExt: Set<number>;
  constructor(principal: PDFFont, extra: PDFFont) {
    this.principal = principal;
    this.extra = extra;
    this.cubiertos = new Set(principal.getCharacterSet());
    this.cubiertosExt = new Set(extra.getCharacterSet());
  }

  /** Trozos de texto con la fuente que tiene sus caracteres. */
  trozos(texto: string): { texto: string; fuente: PDFFont }[] {
    const res: { texto: string; fuente: PDFFont }[] = [];
    for (const ch of texto) {
      const cp = ch.codePointAt(0)!;
      const fuente = this.cubiertos.has(cp) || !this.cubiertosExt.has(cp) ? this.principal : this.extra;
      // Sin glifo en ninguna: se sustituye por «?» en lugar de un recuadro vacío.
      const visible = this.cubiertos.has(cp) || this.cubiertosExt.has(cp) ? ch : "?";
      const ultimo = res.at(-1);
      if (ultimo && ultimo.fuente === fuente) ultimo.texto += visible;
      else res.push({ texto: visible, fuente });
    }
    return res;
  }

  /** El texto tal como se dibuja (los caracteres sin glifo pasan a «?»). */
  visible(texto: string): string {
    return this.trozos(texto).map((t) => t.texto).join("");
  }

  ancho(texto: string, tam: number): number {
    return this.trozos(texto).reduce((s, t) => s + t.fuente.widthOfTextAtSize(t.texto, tam), 0);
  }

  dibujar(pagina: PDFPage, texto: string, x: number, y: number, tam: number, c: RGB) {
    let cx = x;
    for (const t of this.trozos(texto)) {
      pagina.drawText(t.texto, { x: cx, y, size: tam, font: t.fuente, color: c });
      cx += t.fuente.widthOfTextAtSize(t.texto, tam);
    }
  }
}

/** Divide el texto en líneas que caben en `ancho` (respeta saltos de línea; corta palabras imposibles). */
export function envolver(texto: string, medir: (t: string) => number, ancho: number): string[] {
  const lineas: string[] = [];
  for (const parrafo of texto.replace(/\t/g, " ").split("\n")) {
    const palabras = parrafo.split(/ +/).filter(Boolean);
    if (palabras.length === 0) {
      lineas.push("");
      continue;
    }
    let actual = "";
    for (let palabra of palabras) {
      // Palabra más ancha que la línea: se parte por caracteres.
      while (medir(palabra) > ancho) {
        if (actual) {
          lineas.push(actual);
          actual = "";
        }
        let corte = 1;
        const letras = [...palabra];
        while (corte < letras.length && medir(letras.slice(0, corte + 1).join("")) <= ancho) corte++;
        lineas.push(letras.slice(0, corte).join(""));
        palabra = letras.slice(corte).join("");
      }
      if (!palabra) continue;
      const prueba = actual ? `${actual} ${palabra}` : palabra;
      if (medir(prueba) <= ancho) actual = prueba;
      else {
        lineas.push(actual);
        actual = palabra;
      }
    }
    if (actual) lineas.push(actual);
  }
  return lineas;
}

/** Recorta con «…» para que quepa en una línea. */
function ajustar(texto: string, medir: (t: string) => number, ancho: number): string {
  if (medir(texto) <= ancho) return texto;
  const letras = [...texto];
  while (letras.length > 1 && medir(`${letras.join("")}…`) > ancho) letras.pop();
  return `${letras.join("").trimEnd()}…`;
}

// -------------------------------------------------------------------- lienzo
type Estilo = { fuente: Fuente; tam: number; color: RGB; interlinea?: number };

class Lienzo {
  readonly paginas: PDFPage[] = [];
  readonly trazas: Traza[] = [];
  pagina!: PDFPage;
  y = 0;

  private readonly doc: PDFDocument;
  private readonly alNuevaPagina: (l: Lienzo, numero: number) => void;

  constructor(doc: PDFDocument, alNuevaPagina: (l: Lienzo, numero: number) => void) {
    this.doc = doc;
    this.alNuevaPagina = alNuevaPagina;
  }

  nuevaPagina() {
    this.pagina = this.doc.addPage([PAGINA.ancho, PAGINA.alto]);
    this.paginas.push(this.pagina);
    this.alNuevaPagina(this, this.paginas.length);
  }

  /** Garantiza `alto` puntos libres antes del pie; si no caben, página nueva. */
  espacio(alto: number) {
    if (this.y - alto < MARGEN.inferior) this.nuevaPagina();
  }

  escribir(texto: string, x: number, yBase: number, e: Estilo, zona: Traza["zona"] = "cuerpo", p = this.pagina) {
    if (!texto) return;
    e.fuente.dibujar(p, texto, x, yBase, e.tam, e.color);
    this.trazas.push({
      pagina: this.paginas.indexOf(p) + 1,
      x,
      y: yBase,
      ancho: e.fuente.ancho(texto, e.tam),
      alto: e.tam,
      texto: e.fuente.visible(texto),
      zona,
    });
  }

  /** Párrafo ajustado a `ancho`, línea a línea (puede continuar en otra página). */
  parrafo(texto: string, e: Estilo, x: number = MARGEN.x, ancho: number = ANCHO_UTIL) {
    const interlinea = e.interlinea ?? e.tam * 1.45;
    for (const linea of envolver(texto, (t) => e.fuente.ancho(t, e.tam), ancho)) {
      this.espacio(interlinea);
      this.escribir(linea, x, this.y - e.tam, e);
      this.y -= interlinea;
    }
  }

  rect(x: number, y: number, ancho: number, alto: number, relleno: RGB, borde?: RGB) {
    this.pagina.drawRectangle({ x, y, width: ancho, height: alto, color: relleno, borderColor: borde, borderWidth: borde ? 0.6 : 0 });
  }
}

// ------------------------------------------------------------------ informe
async function incrustar(doc: PDFDocument, b: BytesFuente): Promise<Fuente> {
  const [latin, ext] = await Promise.all([doc.embedFont(b.latin, { subset: true }), doc.embedFont(b.latinExt, { subset: true })]);
  return new Fuente(latin, ext);
}

export async function generarPdfInforme(
  m: InformeEvaluacion,
  fuentes: FuentesInforme,
): Promise<{ bytes: Uint8Array; paginas: number; trazas: Traza[] }> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [titulo, normal, semi, negrita] = await Promise.all([
    incrustar(doc, fuentes.titulo),
    incrustar(doc, fuentes.normal),
    incrustar(doc, fuentes.seminegrita),
    incrustar(doc, fuentes.negrita),
  ]);

  const fechaEvaluacion = textoFecha(m.fecha);
  doc.setTitle(`Informe de evaluación · ${m.jugador.nombre} · ${fechaEvaluacion}`);
  doc.setAuthor(m.escuela);
  doc.setSubject(TIPO_TEXTO[m.tipo]);
  doc.setCreator("ÉVORA PADEL");
  doc.setProducer("ÉVORA PADEL");
  doc.setLanguage("es-ES");

  const cuerpo: Estilo = { fuente: normal, tam: 9.8, color: C.texto };
  const pequeno: Estilo = { fuente: normal, tam: 7.8, color: C.tenue };

  const lienzo = new Lienzo(doc, (l, numero) => {
    if (numero === 1) {
      cabeceraPrincipal(l);
      l.y = PAGINA.alto - ALTO_CABECERA - 24;
    } else {
      cabeceraContinuacion(l);
      l.y = PAGINA.alto - MARGEN.superiorContinuacion;
    }
  });

  function marca(l: Lienzo, x: number, yBase: number, tam: number) {
    const e = { fuente: titulo, tam, color: C.blanco };
    l.escribir("ÉVORA", x, yBase, e, "cabecera");
    const ancho = titulo.ancho("ÉVORA", tam);
    l.escribir("PADEL", x + ancho + tam * 0.25, yBase, { fuente: titulo, tam: tam * 0.48, color: C.verde }, "cabecera");
  }

  function cabeceraPrincipal(l: Lienzo) {
    l.rect(0, PAGINA.alto - ALTO_CABECERA, PAGINA.ancho, ALTO_CABECERA, C.noche);
    l.rect(MARGEN.x, PAGINA.alto - 34, 34, 4, C.verde);
    marca(l, MARGEN.x, PAGINA.alto - 66, 30);
    l.escribir("Observa. Mide. Haz crecer.", MARGEN.x, PAGINA.alto - 88, { fuente: semi, tam: 9.5, color: C.verde }, "cabecera");
    // Derecha: tipo de documento y escuela (tratamiento tipográfico, sin logotipo).
    const derecha = PAGINA.ancho - MARGEN.x;
    const etiqueta = "INFORME DE EVALUACIÓN";
    l.escribir(etiqueta, derecha - negrita.ancho(etiqueta, 8), PAGINA.alto - 44, { fuente: negrita, tam: 8, color: C.verde }, "cabecera");
    const lineas = envolver(m.escuela, (t) => negrita.ancho(t, 12.5), 250).slice(0, 2);
    if (envolver(m.escuela, (t) => negrita.ancho(t, 12.5), 250).length > 2) {
      lineas[1] = ajustar(`${lineas[1]} …`, (t) => negrita.ancho(t, 12.5), 250);
    }
    lineas.forEach((linea, i) =>
      l.escribir(linea, derecha - negrita.ancho(linea, 12.5), PAGINA.alto - 64 - i * 16, { fuente: negrita, tam: 12.5, color: C.blanco }, "cabecera"),
    );
  }

  function cabeceraContinuacion(l: Lienzo) {
    l.rect(0, PAGINA.alto - 34, PAGINA.ancho, 34, C.noche);
    marca(l, MARGEN.x, PAGINA.alto - 22, 13);
    const texto = ajustar(`${m.jugador.nombre} · ${fechaEvaluacion}`, (t) => normal.ancho(t, 8.5), 300);
    l.escribir(texto, PAGINA.ancho - MARGEN.x - normal.ancho(texto, 8.5), PAGINA.alto - 21, { fuente: normal, tam: 8.5, color: C.blanco }, "cabecera");
  }

  function seccion(texto: string, minimoSiguiente = 40) {
    lienzo.y -= 10;
    lienzo.espacio(26 + minimoSiguiente);
    lienzo.rect(MARGEN.x, lienzo.y - 15, 4, 15, C.verde, C.noche);
    lienzo.escribir(texto.toUpperCase(), MARGEN.x + 11, lienzo.y - 13, { fuente: titulo, tam: 13.5, color: C.noche });
    lienzo.y -= 24;
  }

  lienzo.nuevaPagina();

  // --- Jugador y datos de la evaluación
  for (const linea of envolver(m.jugador.nombre, (t) => titulo.ancho(t, 24), ANCHO_UTIL)) {
    lienzo.espacio(28);
    lienzo.escribir(linea, MARGEN.x, lienzo.y - 22, { fuente: titulo, tam: 24, color: C.noche });
    lienzo.y -= 28;
  }
  lienzo.parrafo([TIPO_TEXTO[m.tipo], fechaEvaluacion, m.titulo].filter(Boolean).join(" · "), { fuente: semi, tam: 10, color: C.tenue });

  const datos: [string, string][] = [
    ["Grupo", m.grupo ?? "Sin grupo"],
    ["Nivel", m.jugador.nivel ? (NIVEL_TEXTO[m.jugador.nivel as NivelBD] ?? m.jugador.nivel) : "Sin indicar"],
    ["Entrenador/a", m.entrenador ?? TEXTO_SIN_ENTRENADOR],
    ["Fecha de la evaluación", fechaEvaluacion],
  ];
  lienzo.y -= 10;
  const columna = ANCHO_UTIL / 2;
  const filasDatos: [string, string][][] = [datos.slice(0, 2), datos.slice(2, 4)];
  const altoCelda = 34;
  lienzo.espacio(altoCelda * filasDatos.length + 10);
  lienzo.rect(MARGEN.x, lienzo.y - altoCelda * filasDatos.length - 8, ANCHO_UTIL, altoCelda * filasDatos.length + 8, C.suave);
  lienzo.y -= 4;
  for (const fila of filasDatos) {
    fila.forEach(([etiqueta, valor], i) => {
      const x = MARGEN.x + 12 + i * columna;
      lienzo.escribir(etiqueta.toUpperCase(), x, lienzo.y - 11, { fuente: negrita, tam: 7, color: C.tenue });
      lienzo.escribir(ajustar(valor, (t) => semi.ancho(t, 10.5), columna - 24), x, lienzo.y - 25, { fuente: semi, tam: 10.5, color: C.noche });
    });
    lienzo.y -= altoCelda;
  }
  lienzo.y -= 4;

  // --- Competencias
  seccion("Competencias evaluadas", 60);
  lienzo.espacio(22);
  const resumen = `Media ${textoMediaEvaluacion(m.media)} / 5 · ${m.puntuaciones.length} ${m.puntuaciones.length === 1 ? "competencia evaluada" : "competencias evaluadas"}`;
  lienzo.escribir(resumen, MARGEN.x, lienzo.y - 11, { fuente: negrita, tam: 11, color: C.noche });
  lienzo.y -= 22;

  const xBarra = MARGEN.x + 238;
  const segmento = { ancho: 25, alto: 9, hueco: 3 };
  const xNota = xBarra + 5 * (segmento.ancho + segmento.hueco) + 10;
  for (const p of m.puntuaciones) {
    const lineasNombre = envolver(p.nombre, (t) => semi.ancho(t, 10), 225);
    const alto = Math.max(lineasNombre.length * 13 + 12, 30);
    lienzo.espacio(alto);
    const yFila = lienzo.y;
    lineasNombre.forEach((linea, i) => lienzo.escribir(linea, MARGEN.x, yFila - 12 - i * 13, { fuente: semi, tam: 10, color: C.noche }));
    lienzo.escribir(AREA_TEXTO[p.area], MARGEN.x, yFila - 12 - lineasNombre.length * 13, { fuente: normal, tam: 7.8, color: C.tenue });
    for (let i = 1; i <= 5; i++) {
      const x = xBarra + (i - 1) * (segmento.ancho + segmento.hueco);
      lienzo.rect(x, yFila - 18, segmento.ancho, segmento.alto, i <= p.puntuacion ? C.verde : C.vacio, i <= p.puntuacion ? C.noche : undefined);
    }
    lienzo.escribir(`${p.puntuacion} · ${ESCALA_NOTAS[p.puntuacion]}`, xNota, yFila - 17, { fuente: semi, tam: 9.5, color: C.noche });
    lienzo.y -= alto;
    lienzo.pagina.drawLine({ start: { x: MARGEN.x, y: lienzo.y + 4 }, end: { x: PAGINA.ancho - MARGEN.x, y: lienzo.y + 4 }, thickness: 0.4, color: C.linea });
  }
  lienzo.y -= 4;
  lienzo.parrafo(
    `Escala: ${Object.entries(ESCALA_NOTAS).map(([n, t]) => `${n} ${t}`).join(" · ")}.`,
    pequeno,
  );

  // --- Textos del entrenador (solo los que existen: no se inventa nada)
  const bloques: [string, string | null][] = [
    ["Fortalezas", m.fortalezas],
    ["Áreas prioritarias de mejora", m.mejoras],
  ];
  for (const [t, contenido] of bloques) {
    if (!contenido) continue;
    seccion(t);
    lienzo.parrafo(contenido, cuerpo);
  }

  if (m.objetivos.length > 0) {
    seccion("Objetivos de mejora");
    for (const o of m.objetivos) {
      const lineas = envolver(o.descripcion, (t) => normal.ancho(t, 9.8), ANCHO_UTIL - 16);
      const alto = lineas.length * 14.2 + (o.plazo ? 13 : 0) + 5;
      lienzo.espacio(Math.min(alto, 60));
      lienzo.escribir("•", MARGEN.x + 2, lienzo.y - 9.8, cuerpo);
      lienzo.parrafo(o.descripcion, cuerpo, MARGEN.x + 16, ANCHO_UTIL - 16);
      if (o.plazo) lienzo.parrafo(`Plazo: ${textoFecha(o.plazo)}`, { fuente: semi, tam: 8.5, color: C.tenue }, MARGEN.x + 16, ANCHO_UTIL - 16);
      lienzo.y -= 5;
    }
  }

  if (m.observaciones) {
    seccion("Observaciones del entrenador/a");
    lienzo.parrafo(m.observaciones, cuerpo);
  }

  // --- Evolución (solo con datos comparables reales)
  seccion("Evolución");
  if (!m.comparacion) {
    lienzo.parrafo(textoSinComparacion(m), cuerpo);
  } else {
    const c = m.comparacion;
    lienzo.parrafo(
      `Comparación con la evaluación anterior del mismo tipo (${textoFecha(c.fechaAnterior)}), solo en las competencias puntuadas en ambas.`,
      cuerpo,
    );
    lienzo.y -= 6;
    const cols = [MARGEN.x + 8, MARGEN.x + 300, MARGEN.x + 365, MARGEN.x + 430];
    const cabeceraTabla = () => {
      lienzo.espacio(20 + 22);
      lienzo.rect(MARGEN.x, lienzo.y - 20, ANCHO_UTIL, 20, C.noche);
      ["Competencia", "Anterior", "Actual", "Cambio"].forEach((t, i) =>
        lienzo.escribir(t, cols[i], lienzo.y - 13.5, { fuente: negrita, tam: 8.5, color: C.blanco }),
      );
      lienzo.y -= 20;
    };
    cabeceraTabla();
    for (const f of c.filas) {
      const lineas = envolver(f.nombre, (t) => normal.ancho(t, 9.5), 280);
      const alto = lineas.length * 12 + 10;
      if (lienzo.y - alto < MARGEN.inferior) {
        lienzo.nuevaPagina();
        cabeceraTabla();
      }
      const yFila = lienzo.y;
      lineas.forEach((linea, i) => lienzo.escribir(linea, cols[0], yFila - 13 - i * 12, { fuente: normal, tam: 9.5, color: C.texto }));
      lienzo.escribir(String(f.anterior), cols[1] + 14, yFila - 13, { fuente: semi, tam: 9.5, color: C.texto });
      lienzo.escribir(String(f.actual), cols[2] + 10, yFila - 13, { fuente: semi, tam: 9.5, color: C.texto });
      const cambio = textoDiferencia(f.diferencia);
      if (f.diferencia !== 0) lienzo.rect(cols[3] - 2, yFila - 17, 30, 14, f.diferencia > 0 ? C.verde : C.naranja);
      lienzo.escribir(cambio, cols[3] + 13 - negrita.ancho(cambio, 9.5) / 2, yFila - 13, { fuente: negrita, tam: 9.5, color: f.diferencia === 0 ? C.tenue : C.noche });
      lienzo.y -= alto;
      lienzo.pagina.drawLine({ start: { x: MARGEN.x, y: lienzo.y + 2 }, end: { x: PAGINA.ancho - MARGEN.x, y: lienzo.y + 2 }, thickness: 0.4, color: C.linea });
    }
    lienzo.y -= 6;
    lienzo.parrafo(
      `Media de las competencias comparadas: de ${textoMediaEvaluacion(c.mediaAnterior)} a ${textoMediaEvaluacion(c.mediaActual)}.`,
      { fuente: semi, tam: 9.8, color: C.noche },
    );
    if (c.sinComparar > 0) {
      lienzo.parrafo(
        `${c.sinComparar} ${c.sinComparar === 1 ? "competencia de esta evaluación no se puntuó" : "competencias de esta evaluación no se puntuaron"} en la anterior y no se comparan.`,
        pequeno,
      );
    }
  }

  // --- Pie con numeración (cuando ya se conoce el total de páginas)
  const total = lienzo.paginas.length;
  lienzo.paginas.forEach((p, i) => {
    p.drawLine({ start: { x: MARGEN.x, y: 50 }, end: { x: PAGINA.ancho - MARGEN.x, y: 50 }, thickness: 0.5, color: C.linea });
    const numero = total > 1 ? `Página ${i + 1} de ${total}` : "";
    const anchoNumero = numero ? semi.ancho(numero, 7.8) : 0;
    const izquierda = ajustar(`ÉVORA PADEL · ${m.escuela}`, (t) => semi.ancho(t, 7.8), ANCHO_UTIL - anchoNumero - 20);
    lienzo.escribir(izquierda, MARGEN.x, 38, { fuente: semi, tam: 7.8, color: C.noche }, "pie", p);
    if (numero) lienzo.escribir(numero, PAGINA.ancho - MARGEN.x - anchoNumero, 38, { fuente: semi, tam: 7.8, color: C.noche }, "pie", p);
    lienzo.escribir(
      `Emitido el ${textoFecha(m.emitido)} · Documento privado: compártelo solo con el jugador y su familia.`,
      MARGEN.x,
      26,
      { fuente: normal, tam: 7, color: C.tenue },
      "pie",
      p,
    );
  });

  return { bytes: await doc.save(), paginas: total, trazas: lienzo.trazas };
}
