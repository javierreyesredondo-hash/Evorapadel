"use client";

import { useEffect } from "react";
import { useAlmacen } from "@/lib/almacen";
import { useAvisos } from "@/components/gestion/Avisos";

/** Aviso permanente de modo demostración, con opción de volver a los datos iniciales. */
export function BannerDemo() {
  const { despachar, mostrarAviso } = useAlmacen();
  return (
    <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-naranja/40 bg-naranja/10 px-3 py-2 text-xs text-naranja">
      <p>
        <strong className="font-bold">Modo demostración:</strong> todos los jugadores y datos son
        ficticios. Los cambios se guardan solo en este navegador y no se mezclan con los datos
        reales de tu escuela.
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

/**
 * Las confirmaciones de la demo («Evaluación guardada») se muestran con el
 * mismo aviso que las pantallas reales: una sola región de estado en la página.
 */
export function PuenteAvisosDemo() {
  const { aviso } = useAlmacen();
  const { avisar } = useAvisos();
  useEffect(() => {
    if (aviso) avisar(aviso);
  }, [aviso, avisar]);
  return null;
}
