// Lógica pura de rutas (sin Next) usada por src/proxy.ts; probada con node --test.

import { jugadores } from "./demo-data.ts";
import { esUuid } from "./gestion.ts";

const IDS_DEMO = new Set(jugadores.map((j) => j.id));
const PREFIJO_DEMO = "/demo/jugadores/";

/** Segmento que sigue a `prefijo` (decodificado), o null si no es esa ruta, hay más segmentos o la codificación es inválida ("%E0%A4%A"). */
export function idDeRuta(pathname: string, prefijo: string): string | null {
  if (!pathname.startsWith(prefijo)) return null;
  const resto = pathname.slice(prefijo.length);
  if (resto === "" || resto.includes("/")) return null;
  try {
    return decodeURIComponent(resto);
  } catch {
    return null;
  }
}

export type DecisionRuta = { tipo: "seguir" } | { tipo: "no-encontrado" } | { tipo: "redirigir"; destino: string };

/**
 * Qué hacer con una ficha antes de renderizar (con Cache Components, notFound()
 * en la página llega tarde y el código sería 200):
 *   /demo/jugadores/<id>  → 404 si no es un jugador ficticio (distingue mayúsculas).
 *   /jugadores/<j1…j6>    → enlaces antiguos de la demo: a /demo/jugadores/<id>.
 *   /jugadores/<x>, /grupos/<x> → 404 si <x> no es «nuevo» ni un UUID. Si es un
 *   UUID, la página consulta la base de datos (RLS decide si se ve).
 */
export function decidirRuta(pathname: string): DecisionRuta {
  if (esFicha(pathname, PREFIJO_DEMO)) {
    const id = idDeRuta(pathname, PREFIJO_DEMO);
    return id !== null && IDS_DEMO.has(id) ? { tipo: "seguir" } : { tipo: "no-encontrado" };
  }
  for (const prefijo of ["/jugadores/", "/grupos/"]) {
    if (!esFicha(pathname, prefijo)) continue;
    const id = idDeRuta(pathname, prefijo);
    if (id === null) return { tipo: "no-encontrado" }; // codificación inválida
    if (prefijo === "/jugadores/" && IDS_DEMO.has(id)) return { tipo: "redirigir", destino: `${PREFIJO_DEMO}${id}` };
    return id === "nuevo" || esUuid(id) ? { tipo: "seguir" } : { tipo: "no-encontrado" };
  }
  return { tipo: "seguir" };
}

/** «<prefijo><un segmento>»: rutas con más segmentos (…/editar) las resuelve Next. */
function esFicha(pathname: string, prefijo: string): boolean {
  const resto = pathname.slice(prefijo.length);
  return pathname.startsWith(prefijo) && resto !== "" && !resto.includes("/");
}
