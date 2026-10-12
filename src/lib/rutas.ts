// Lógica pura de rutas (sin Next) usada por src/proxy.ts; probada con node --test.

import { jugadores } from "./demo-data.ts";

const IDS = new Set(jugadores.map((j) => j.id));
const PREFIJO = "/jugadores/";

/** Identificador de /jugadores/<id>, o null si no es esa ruta o la codificación es inválida ("%E0%A4%A"). */
export function idJugadorDeRuta(pathname: string): string | null {
  if (!pathname.startsWith(PREFIJO)) return null;
  const resto = pathname.slice(PREFIJO.length);
  if (resto === "" || resto.includes("/")) return null;
  try {
    return decodeURIComponent(resto);
  } catch {
    return null;
  }
}

/** true si la ruta es la ficha de un jugador que existe (distingue mayúsculas: "J1" no existe). */
export function esFichaExistente(pathname: string): boolean {
  const id = idJugadorDeRuta(pathname);
  return id !== null && IDS.has(id);
}
