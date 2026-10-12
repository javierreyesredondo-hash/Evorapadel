"use client";

import { useAlmacen } from "@/lib/almacen";

/** Aviso permanente de modo demostración, con opción de volver a los datos iniciales. */
export function BannerDemo() {
  const { despachar, mostrarAviso } = useAlmacen();
  return (
    <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-naranja/40 bg-naranja/10 px-3 py-2 text-xs text-naranja">
      <p>
        <strong className="font-bold">Modo demostración:</strong> todos los jugadores y datos son
        ficticios. Los cambios se guardan solo en este navegador.
      </p>
      <button
        type="button"
        className="-my-3 -mr-2 inline-flex min-h-11 shrink-0 items-center px-2 font-bold underline underline-offset-2"
        onClick={() => {
          if (window.confirm("¿Borrar tus cambios y volver a los datos ficticios iniciales?")) {
            despachar({ tipo: "restablecer" });
            mostrarAviso("Datos de demostración restablecidos");
          }
        }}
      >
        Restablecer
      </button>
    </div>
  );
}

/** Confirmación breve tras guardar. */
export function Aviso() {
  const { aviso } = useAlmacen();
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4 md:bottom-6"
    >
      {aviso && (
        <p className="rounded-full bg-blanco px-4 py-2 text-sm font-bold text-noche shadow-lg">{aviso}</p>
      )}
    </div>
  );
}
