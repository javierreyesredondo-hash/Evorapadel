// Reconstrucción de líneas a partir de los fragmentos de texto de un PDF
// (tal como los devuelve pdf.js, en el orden del documento). Lógica pura,
// probada con node --test.
//
//   * Una LÍNEA lógica reúne los fragmentos de la misma altura y, además, las
//     continuaciones de un texto que se ha partido en varias líneas (párrafos,
//     celdas de tabla, «Agresividad: 1 2 / 3 4 5»).
//   * Dentro de una línea, un hueco grande (espacios anchos o distancia en x)
//     separa SEGMENTOS: las celdas de una tabla o los bloques de una fila.

export type FragmentoTexto = {
  texto: string;
  x: number;
  y: number;
  ancho: number;
  tam: number;
  negrita: boolean;
  /** pdf.js indica que tras este fragmento hay un salto de línea. */
  finDeLinea: boolean;
};

export type Segmento = { x: number; texto: string };
export type Linea = { y: number; tam: number; negrita: boolean; segmentos: Segmento[] };

/** Texto de una línea (segmentos unidos). */
export const textoLinea = (l: Linea) => l.segmentos.map((s) => s.texto).join(" ").replace(/\s+/g, " ").trim();

// Un texto que empieza un campo o una opción no continúa el anterior.
const INICIO_DE_ELEMENTO = /^(☐|□|\d+\s*[:.)]\s|[^:]{1,60}:\s*(_{3,}|1\s*2\s*3\s*4\s*5))/;
const FIN_DE_CAMPO = /(_{3,}["”»]?|:)\s*$/;

export function construirLineas(fragmentos: readonly FragmentoTexto[]): Linea[] {
  const lineas: Linea[] = [];
  let actual: (Linea & { yUltima: number; xFin: number }) | null = null;
  let hueco = false;
  let anteriorFinDeLinea = false;

  const cerrar = () => {
    if (actual) {
      const segmentos = actual.segmentos.map((s) => ({ x: s.x, texto: s.texto.replace(/\s+/g, " ").trim() })).filter((s) => s.texto);
      if (segmentos.length > 0) lineas.push({ y: actual.y, tam: actual.tam, negrita: actual.negrita, segmentos });
    }
    actual = null;
    hueco = false;
  };

  for (const f of fragmentos) {
    // Fragmento vacío: pdf.js lo usa para empezar un bloque nuevo.
    if (f.texto === "") {
      if (f.finDeLinea) {
        cerrar();
        anteriorFinDeLinea = false;
      }
      continue;
    }
    // Solo espacios: si es ancho, separa celdas.
    if (f.texto.trim() === "") {
      if (f.ancho > 3 * f.tam) hueco = true;
      continue;
    }

    if (actual) {
      // Misma fila: a la altura de la línea o de su última continuación (una
      // celda partida no saca de la fila a las celdas que la siguen).
      const tolerancia = 0.4 * Math.max(f.tam, actual.tam);
      const mismaAltura = Math.abs(f.y - actual.y) <= tolerancia || Math.abs(f.y - actual.yUltima) <= tolerancia;
      if (mismaAltura) {
        const separado = hueco || f.x - actual.xFin > 3 * f.tam;
        const ultimo = actual.segmentos[actual.segmentos.length - 1];
        if (separado || !ultimo) actual.segmentos.push({ x: f.x, texto: f.texto });
        else ultimo.texto += (f.x - actual.xFin > 0.15 * f.tam ? " " : "") + f.texto;
        actual.xFin = f.x + f.ancho;
        actual.tam = Math.max(actual.tam, f.tam);
        actual.negrita = actual.negrita && f.negrita;
        hueco = false;
        anteriorFinDeLinea = f.finDeLinea;
        continue;
      }

      // ¿Continuación de un texto partido en varias líneas?
      const bajada = actual.yUltima - f.y;
      const ultimo = actual.segmentos[actual.segmentos.length - 1];
      const continua =
        anteriorFinDeLinea &&
        Math.abs(f.tam - actual.tam) < 0.5 &&
        bajada > 0 &&
        bajada <= 2.2 * f.tam &&
        !INICIO_DE_ELEMENTO.test(f.texto.trim()) &&
        !(ultimo && FIN_DE_CAMPO.test(ultimo.texto));
      if (continua) {
        // Continúa el texto que se estaba escribiendo: el último segmento.
        ultimo!.texto += " " + f.texto;
        actual.yUltima = f.y;
        actual.xFin = f.x + f.ancho;
        hueco = false;
        anteriorFinDeLinea = f.finDeLinea;
        continue;
      }
      cerrar();
    }

    actual = { y: f.y, yUltima: f.y, xFin: f.x + f.ancho, tam: f.tam, negrita: f.negrita, segmentos: [{ x: f.x, texto: f.texto }] };
    hueco = false;
    anteriorFinDeLinea = f.finDeLinea;
  }
  cerrar();
  return lineas;
}
