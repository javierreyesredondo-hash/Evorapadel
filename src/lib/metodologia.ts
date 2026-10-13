// Metodología ÉVORA: escala de puntuación y competencias de partida.
//
// La escala 1–5 es fija (requisito del producto y CHECK de la base de datos).
// Las competencias NO son fijas: cada escuela tiene las suyas en la tabla
// public.competencias y la dirección las puede cambiar. METODOLOGIA_BASE es solo
// una propuesta inicial que la dirección puede cargar con un botón.

export type AreaCompetencia = "tecnica" | "tactica" | "fisica" | "mental";

export const AREA_TEXTO: Record<AreaCompetencia, string> = {
  tecnica: "Técnica",
  tactica: "Táctica",
  fisica: "Física",
  mental: "Mental",
};
export const AREAS_COMPETENCIA = Object.keys(AREA_TEXTO) as AreaCompetencia[];

/** Significado de cada nota entera de 1 a 5. */
export type Escala = Record<1 | 2 | 3 | 4 | 5, string>;

/** Escala de la metodología base ÉVORA (la de siempre). */
export const ESCALA_NOTAS: Escala = {
  1: "Inicial",
  2: "En desarrollo",
  3: "Competente",
  4: "Avanzado",
  5: "Excelente",
};

export const METODOLOGIA_BASE: readonly { nombre: string; area: AreaCompetencia; descripcion: string }[] = [
  { nombre: "Golpes de fondo", area: "tecnica", descripcion: "Consistencia, profundidad y dirección de derecha y revés desde el fondo de pista." },
  { nombre: "Juego en la red", area: "tecnica", descripcion: "Voleas de derecha y revés: posición, control y colocación." },
  { nombre: "Juego aéreo", area: "tecnica", descripcion: "Bandeja, víbora y remate: elección del golpe y ejecución." },
  { nombre: "Lectura táctica", area: "tactica", descripcion: "Elige el golpe según la situación, ocupa bien la pista y se coordina con su pareja." },
  { nombre: "Condición física", area: "fisica", descripcion: "Desplazamientos, resistencia y recuperación durante los puntos." },
  { nombre: "Fortaleza mental", area: "mental", descripcion: "Concentración, gestión del error y actitud ante la presión." },
];

/** Categoría de una competencia: el grupo de su metodología importada o su área. */
export function etiquetaGrupo(c: { area: AreaCompetencia | null; grupo?: string | null }): string {
  return c.grupo ?? (c.area ? AREA_TEXTO[c.area] : "");
}

/**
 * Escala de una metodología importada (sus cinco niveles) o, si no tiene una
 * completa, la escala ÉVORA. La puntuación es siempre un entero de 1 a 5.
 */
export function escalaDe(niveles: unknown): Escala {
  if (!Array.isArray(niveles) || niveles.length !== 5) return ESCALA_NOTAS;
  const escala: Partial<Escala> = {};
  for (const n of niveles) {
    const valor = (n as { valor?: unknown })?.valor;
    const nombre = (n as { nombre?: unknown })?.nombre;
    if (![1, 2, 3, 4, 5].includes(valor as number) || typeof nombre !== "string" || !nombre.trim()) return ESCALA_NOTAS;
    escala[valor as keyof Escala] = nombre.trim();
  }
  return Object.keys(escala).length === 5 ? (escala as Escala) : ESCALA_NOTAS;
}
