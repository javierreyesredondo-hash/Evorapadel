// Lógica pura de rutas (sin Next) usada por src/proxy.ts; probada con node --test.

import { esUuid } from "./gestion.ts";

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

export type DecisionRuta = { tipo: "seguir" } | { tipo: "no-encontrado" };

/**
 * Qué hacer con una ficha antes de renderizar (con Cache Components, notFound()
 * en la página llega tarde y el código sería 200):
 *   /jugadores/<x>, /grupos/<x>, /evaluaciones/<x> → 404 si <x> no es
 *   «nuevo»/«nueva» ni un UUID. Si es un
 *   UUID, la página consulta la base de datos (RLS decide si se ve).
 */
export function decidirRuta(pathname: string): DecisionRuta {
  for (const prefijo of ["/jugadores/", "/grupos/", "/evaluaciones/"]) {
    if (!esFicha(pathname, prefijo)) continue;
    const id = idDeRuta(pathname, prefijo);
    if (id === null) return { tipo: "no-encontrado" }; // codificación inválida
    return id === "nuevo" || id === "nueva" || esUuid(id) ? { tipo: "seguir" } : { tipo: "no-encontrado" };
  }
  return { tipo: "seguir" };
}

/** «<prefijo><un segmento>»: rutas con más segmentos (…/editar) las resuelve Next. */
function esFicha(pathname: string, prefijo: string): boolean {
  const resto = pathname.slice(prefijo.length);
  return pathname.startsWith(prefijo) && resto !== "" && !resto.includes("/");
}
