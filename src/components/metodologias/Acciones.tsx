"use client";

import { activarMetodologia, archivarMetodologia } from "@/app/acciones-metodologias";
import { claseBoton } from "@/components/ui";
import { ErrorAccion, useAccion } from "@/components/gestion/Acciones";

/** Activar (con confirmación que explica los efectos) o archivar un borrador. */
export function AccionesMetodologia({
  id,
  nombre,
  estado,
  evaluables,
  activa,
}: {
  id: string;
  nombre: string;
  estado: "borrador" | "activa" | "archivada";
  evaluables: number;
  activa: { nombre: string; version: string } | null;
}) {
  const { pendiente, error, ejecutar } = useAccion();
  if (estado === "activa") return null;

  function activar() {
    const aviso = [
      `¿Activar «${nombre}»?`,
      "",
      `• Las evaluaciones nuevas pedirán sus ${evaluables} competencias evaluables y usarán su escala.`,
      activa
        ? `• «${activa.nombre}» (versión ${activa.version}) se archivará y sus competencias dejarán de pedirse.`
        : "• Las competencias actuales de la escuela dejarán de pedirse (no se borran).",
      "• Las evaluaciones anteriores no cambian: conservan sus notas y la versión con la que se hicieron.",
    ].join("\n");
    if (window.confirm(aviso)) ejecutar(() => activarMetodologia(id));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={pendiente || evaluables === 0} onClick={activar} className={claseBoton.primario}>
          {pendiente ? "Guardando…" : "Activar metodología"}
        </button>
        {estado === "borrador" && (
          <button
            type="button"
            disabled={pendiente}
            onClick={() => window.confirm("¿Archivar este borrador? No se borra: quedará en la lista como archivado.") && ejecutar(() => archivarMetodologia(id))}
            className={claseBoton.secundario}
          >
            Archivar borrador
          </button>
        )}
      </div>
      {evaluables === 0 && (
        <p className="mt-2 text-sm text-tenue">
          No tiene competencias evaluables, así que no se puede activar. Vuelve a importar el PDF y marca «Evaluar en ÉVORA» en
          las que quieras puntuar.
        </p>
      )}
      <ErrorAccion error={error} />
    </div>
  );
}
