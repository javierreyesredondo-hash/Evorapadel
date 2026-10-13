import { COMPACTA, PRINCIPAL, SIMBOLO } from "@/components/marca/trazos";

// Marca de ÉVORA PADEL (scripts/generar-marca.mjs): una «É» cuyos brazos crecen
// de abajo arriba y una bola lima como acento. En línea (sin petición extra) y
// con el texto convertido en trazos: se ve igual en cualquier dispositivo.
//
//   principal: símbolo + ÉVORA PADEL en una línea (escritorio, acceso).
//   compacta:  símbolo + ÉVORA / PADEL apilados (cabecera móvil).
// El tamaño lo da la altura (className, p. ej. «h-8»); el ancho sale solo.

export function Logo({ variante = "principal", className = "h-8" }: { variante?: "principal" | "compacta"; className?: string }) {
  const m = variante === "compacta" ? COMPACTA : PRINCIPAL;
  return (
    <svg
      viewBox={`0 0 ${m.ancho} ${m.alto}`}
      role="img"
      aria-label="ÉVORA PADEL"
      className={`block w-auto shrink-0 ${className}`}
    >
      <path className="fill-blanco" d={SIMBOLO.letra} />
      <circle className="fill-electrico" cx={SIMBOLO.bola.cx} cy={SIMBOLO.bola.cy} r={SIMBOLO.bola.r} />
      <path className="fill-blanco" d={m.evora} />
      <path className="fill-electrico" d={m.padel} />
    </svg>
  );
}
