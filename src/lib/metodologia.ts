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

/** Nota entera de 1 a 5 y su significado. */
export const ESCALA_NOTAS: Record<1 | 2 | 3 | 4 | 5, string> = {
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
