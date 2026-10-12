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

const formatoFecha = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-09-18" → "18 sept 2026". En UTC para que servidor y navegador coincidan. */
export function textoFecha(iso: string): string {
  return formatoFecha.format(new Date(`${iso}T00:00:00Z`));
}

/** Fecha local de hoy como AAAA-MM-DD. */
export function hoyIso(ahora = new Date()): string {
  const m = String(ahora.getMonth() + 1).padStart(2, "0");
  const d = String(ahora.getDate()).padStart(2, "0");
  return `${ahora.getFullYear()}-${m}-${d}`;
}
