/** Iniciales para el avatar: "Lucía Marván" → "LM". */
export function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

/**
 * "2026-09-18" → "18 sept 2026". Formato fijo (sin Intl) para que el HTML del
 * servidor y el del navegador coincidan siempre, y sin lanzar errores con
 * fechas inválidas.
 */
export function textoFecha(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const mes = m ? MESES[Number(m[2]) - 1] : undefined;
  if (!m || !mes) return iso;
  return `${Number(m[3])} ${mes} ${m[1]}`;
}

/** Fecha local de hoy como AAAA-MM-DD. */
export function hoyIso(ahora = new Date()): string {
  const m = String(ahora.getMonth() + 1).padStart(2, "0");
  const d = String(ahora.getDate()).padStart(2, "0");
  return `${ahora.getFullYear()}-${m}-${d}`;
}
