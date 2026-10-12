/** Porcentaje entero 0–100 de progreso hacia una meta. */
export function porcentaje(progreso: number, meta: number): number {
  if (meta <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((progreso / meta) * 100)));
}

/** Texto corto de vencimiento: "Vencida hace 2 días", "Hoy", "Mañana", "En 4 días". */
export function textoVencimiento(dias: number): string {
  if (dias < -1) return `Vencida hace ${-dias} días`;
  if (dias === -1) return "Vencida ayer";
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Mañana";
  return `En ${dias} días`;
}

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

/** Media con un decimal y coma decimal: 3.8333 → "3,8". */
export function textoMedia(media: number): string {
  return media.toFixed(1).replace(".", ",");
}

/** Fecha local de hoy como AAAA-MM-DD. */
export function hoyIso(ahora = new Date()): string {
  const m = String(ahora.getMonth() + 1).padStart(2, "0");
  const d = String(ahora.getDate()).padStart(2, "0");
  return `${ahora.getFullYear()}-${m}-${d}`;
}
