// Datos de demostración. Todos los jugadores son FICTICIOS: no hay base
// de datos todavía. Este es el estado inicial de la demo; los cambios del
// usuario se guardan solo en su navegador (ver src/lib/almacen.tsx).

export type Nivel = "Iniciación" | "Intermedio" | "Avanzado" | "Competición";
export type Posicion = "Drive" | "Revés";
export type Area = "Técnica" | "Táctica" | "Física" | "Mental";

export const NIVELES: readonly Nivel[] = ["Iniciación", "Intermedio", "Avanzado", "Competición"];
export const POSICIONES: readonly Posicion[] = ["Drive", "Revés"];
export const AREAS: readonly Area[] = ["Técnica", "Táctica", "Física", "Mental"];

export type Jugador = {
  id: string;
  /** Marca explícita: ningún jugador de la demo es una persona real. */
  ficticio: true;
  nombre: string;
  edad: number;
  mano: "Diestro" | "Zurdo";
  nivel: Nivel;
  posicion: Posicion;
  grupo: string;
  foco: string;
};

export const CRITERIOS = [
  { id: "fondo", nombre: "Golpes de fondo", area: "Técnica" },
  { id: "red", nombre: "Juego en la red", area: "Técnica" },
  { id: "aereo", nombre: "Juego aéreo", area: "Técnica" },
  { id: "tactica", nombre: "Lectura táctica", area: "Táctica" },
  { id: "fisico", nombre: "Condición física", area: "Física" },
  { id: "mental", nombre: "Fortaleza mental", area: "Mental" },
] as const satisfies readonly { id: string; nombre: string; area: Area }[];

export type CriterioId = (typeof CRITERIOS)[number]["id"];

/** Puntuación entera de 1 a 5. */
export type Nota = 1 | 2 | 3 | 4 | 5;

export const ESCALA: Record<Nota, string> = {
  1: "Inicial",
  2: "En desarrollo",
  3: "Competente",
  4: "Avanzado",
  5: "Excelente",
};

export const TIPOS_EVALUACION = [
  "Evaluación inicial",
  "Evaluación técnica",
  "Evaluación táctica",
  "Evaluación trimestral",
  "Seguimiento",
] as const;

export type EvaluacionPendiente = {
  id: string;
  jugadorId: string;
  tipo: string;
  /** Días hasta la fecha prevista; negativo si ya ha vencido. */
  venceEnDias: number;
};

export type EvaluacionRealizada = {
  id: string;
  jugadorId: string;
  tipo: string;
  /** Fecha ISO (AAAA-MM-DD). */
  fecha: string;
  notas: Record<CriterioId, Nota>;
  comentario: string;
};

export type Objetivo = {
  id: string;
  jugadorId: string;
  titulo: string;
  area: Area;
  progreso: number;
  meta: number;
};

export const jugadores: Jugador[] = [
  { id: "j1", ficticio: true, nombre: "Lucía Marván", edad: 17, mano: "Diestro", nivel: "Avanzado", posicion: "Revés", grupo: "Tecnificación A", foco: "Remate por 3" },
  { id: "j2", ficticio: true, nombre: "Diego Ferrán", edad: 34, mano: "Diestro", nivel: "Intermedio", posicion: "Drive", grupo: "Adultos martes", foco: "Salida de pared" },
  { id: "j3", ficticio: true, nombre: "Noa Etxabe", edad: 19, mano: "Zurdo", nivel: "Competición", posicion: "Drive", grupo: "Tecnificación A", foco: "Bandeja profunda" },
  { id: "j4", ficticio: true, nombre: "Mateo Urquiza", edad: 12, mano: "Diestro", nivel: "Iniciación", posicion: "Revés", grupo: "Escuela sub-14", foco: "Volea de derecha" },
  { id: "j5", ficticio: true, nombre: "Irene Solana", edad: 41, mano: "Diestro", nivel: "Intermedio", posicion: "Revés", grupo: "Adultos martes", foco: "Globo defensivo" },
  { id: "j6", ficticio: true, nombre: "Bruno Celaya", edad: 23, mano: "Zurdo", nivel: "Avanzado", posicion: "Drive", grupo: "Tecnificación B", foco: "Víbora" },
];

function n(fondo: Nota, red: Nota, aereo: Nota, tactica: Nota, fisico: Nota, mental: Nota) {
  return { fondo, red, aereo, tactica, fisico, mental };
}

export const evaluacionesIniciales: EvaluacionRealizada[] = [
  { id: "r1", jugadorId: "j1", tipo: "Evaluación técnica", fecha: "2026-06-12", notas: n(4, 3, 3, 4, 4, 3), comentario: "" },
  { id: "r2", jugadorId: "j1", tipo: "Evaluación trimestral", fecha: "2026-09-18", notas: n(4, 4, 4, 4, 4, 4), comentario: "Mejora clara en el remate por 3." },
  { id: "r3", jugadorId: "j2", tipo: "Evaluación inicial", fecha: "2026-06-05", notas: n(3, 3, 2, 3, 3, 3), comentario: "" },
  { id: "r4", jugadorId: "j2", tipo: "Evaluación técnica", fecha: "2026-09-10", notas: n(3, 3, 3, 3, 3, 3), comentario: "" },
  { id: "r5", jugadorId: "j3", tipo: "Evaluación táctica", fecha: "2026-06-20", notas: n(5, 4, 4, 4, 4, 4), comentario: "" },
  { id: "r6", jugadorId: "j3", tipo: "Evaluación trimestral", fecha: "2026-09-22", notas: n(5, 4, 5, 4, 4, 4), comentario: "Bandeja más profunda y estable." },
  { id: "r7", jugadorId: "j4", tipo: "Evaluación inicial", fecha: "2026-06-02", notas: n(2, 1, 1, 2, 3, 2), comentario: "" },
  { id: "r8", jugadorId: "j4", tipo: "Seguimiento", fecha: "2026-09-05", notas: n(2, 2, 2, 2, 3, 3), comentario: "" },
  { id: "r9", jugadorId: "j5", tipo: "Evaluación inicial", fecha: "2026-06-08", notas: n(3, 3, 3, 3, 3, 3), comentario: "" },
  { id: "r10", jugadorId: "j5", tipo: "Seguimiento", fecha: "2026-09-12", notas: n(3, 3, 2, 3, 3, 3), comentario: "" },
  { id: "r11", jugadorId: "j6", tipo: "Evaluación técnica", fecha: "2026-06-15", notas: n(4, 3, 3, 4, 3, 4), comentario: "" },
  { id: "r12", jugadorId: "j6", tipo: "Evaluación táctica", fecha: "2026-09-16", notas: n(4, 4, 4, 4, 3, 4), comentario: "" },
];

export const pendientesIniciales: EvaluacionPendiente[] = [
  { id: "e1", jugadorId: "j5", tipo: "Evaluación técnica", venceEnDias: -2 },
  { id: "e2", jugadorId: "j2", tipo: "Evaluación trimestral", venceEnDias: 0 },
  { id: "e3", jugadorId: "j4", tipo: "Evaluación trimestral", venceEnDias: 1 },
  { id: "e4", jugadorId: "j6", tipo: "Evaluación táctica", venceEnDias: 4 },
];

export const objetivosIniciales: Objetivo[] = [
  { id: "o1", jugadorId: "j1", titulo: "Remates por 3 ganadores", area: "Técnica", progreso: 7, meta: 10 },
  { id: "o2", jugadorId: "j4", titulo: "Voleas seguidas sin error", area: "Técnica", progreso: 12, meta: 20 },
  { id: "o3", jugadorId: "j3", titulo: "Primeros saques dentro por juego", area: "Táctica", progreso: 15, meta: 20 },
  { id: "o4", jugadorId: "j5", titulo: "Sesiones de físico al mes", area: "Física", progreso: 3, meta: 8 },
  { id: "o5", jugadorId: "j2", titulo: "Rutina antes del saque", area: "Mental", progreso: 9, meta: 10 },
];

export function jugadorPorId(id: string): Jugador | undefined {
  return jugadores.find((j) => j.id === id);
}
