/** Marca provisional de ÉVORA PADEL: wordmark + bola eléctrica. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-1.5 font-display ${className}`}>
      <span className="text-2xl font-extrabold italic tracking-tight text-blanco">
        ÉVORA
      </span>
      <span className="text-sm font-bold italic tracking-[0.2em] text-electrico">
        PADEL
      </span>
      <span
        aria-hidden="true"
        className="ml-0.5 inline-block size-2 rounded-full bg-electrico"
      />
    </span>
  );
}
