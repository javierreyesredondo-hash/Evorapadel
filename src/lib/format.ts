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
