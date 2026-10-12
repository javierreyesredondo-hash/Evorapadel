// Datos de demostración. Todos los jugadores son ficticios: no hay
// base de datos todavía (Fase 1).

export type Nivel = "Iniciación" | "Intermedio" | "Avanzado" | "Competición";
export type Posicion = "Drive" | "Revés";

export type Jugador = {
  id: string;
  nombre: string;
  nivel: Nivel;
  posicion: Posicion;
  grupo: string;
  /** Puntuación global 0–100 de la última evaluación. */
  puntuacion: number;
  /** Variación respecto a la evaluación anterior. */
  tendencia: number;
  foco: string;
};

export type Evaluacion = {
  id: string;
  jugadorId: string;
  tipo: string;
  /** Días hasta la fecha prevista; negativo si ya ha vencido. */
  venceEnDias: number;
};

export type Objetivo = {
  id: string;
  jugadorId: string;
  titulo: string;
  area: "Técnica" | "Táctica" | "Física" | "Mental";
  progreso: number;
  meta: number;
  unidad: string;
};

export const jugadores: Jugador[] = [
  { id: "j1", nombre: "Lucía Marván", nivel: "Avanzado", posicion: "Revés", grupo: "Tecnificación A", puntuacion: 78, tendencia: 6, foco: "Remate por 3" },
  { id: "j2", nombre: "Diego Ferrán", nivel: "Intermedio", posicion: "Drive", grupo: "Adultos martes", puntuacion: 61, tendencia: 3, foco: "Salida de pared" },
  { id: "j3", nombre: "Noa Etxabe", nivel: "Competición", posicion: "Drive", grupo: "Tecnificación A", puntuacion: 86, tendencia: 2, foco: "Bandeja profunda" },
  { id: "j4", nombre: "Mateo Urquiza", nivel: "Iniciación", posicion: "Revés", grupo: "Escuela sub-14", puntuacion: 42, tendencia: 9, foco: "Volea de derecha" },
  { id: "j5", nombre: "Irene Solana", nivel: "Intermedio", posicion: "Revés", grupo: "Adultos martes", puntuacion: 58, tendencia: -2, foco: "Globo defensivo" },
  { id: "j6", nombre: "Bruno Celaya", nivel: "Avanzado", posicion: "Drive", grupo: "Tecnificación B", puntuacion: 73, tendencia: 4, foco: "Víbora" },
];

export const evaluaciones: Evaluacion[] = [
  { id: "e1", jugadorId: "j5", tipo: "Evaluación técnica", venceEnDias: -2 },
  { id: "e2", jugadorId: "j2", tipo: "Evaluación trimestral", venceEnDias: 0 },
  { id: "e3", jugadorId: "j4", tipo: "Evaluación inicial", venceEnDias: 1 },
  { id: "e4", jugadorId: "j6", tipo: "Evaluación táctica", venceEnDias: 4 },
];

export const objetivos: Objetivo[] = [
  { id: "o1", jugadorId: "j1", titulo: "Remates por 3 ganadores", area: "Técnica", progreso: 7, meta: 10, unidad: "de 10" },
  { id: "o2", jugadorId: "j4", titulo: "Voleas seguidas sin error", area: "Técnica", progreso: 12, meta: 20, unidad: "de 20" },
  { id: "o3", jugadorId: "j3", titulo: "Primeros saques dentro por juego", area: "Táctica", progreso: 15, meta: 20, unidad: "de 20" },
  { id: "o4", jugadorId: "j5", titulo: "Sesiones de físico al mes", area: "Física", progreso: 3, meta: 8, unidad: "de 8" },
  { id: "o5", jugadorId: "j2", titulo: "Rutina antes del saque", area: "Mental", progreso: 9, meta: 10, unidad: "de 10" },
];

export function jugadorPorId(id: string): Jugador | undefined {
  return jugadores.find((j) => j.id === id);
}
