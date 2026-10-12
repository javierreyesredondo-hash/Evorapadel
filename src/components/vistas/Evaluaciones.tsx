"use client";

import { useAlmacen } from "@/lib/almacen";
import { Cabecera, EnlaceBoton, FilaPendiente, FilaRealizada, Lista, Seccion, Vacio } from "@/components/ui";

export function Evaluaciones() {
  const { estado } = useAlmacen();
  const pendientes = [...estado.pendientes].sort((a, b) => a.venceEnDias - b.venceEnDias);
  const realizadas = estado.evaluaciones
    .map((e, i) => ({ e, i }))
    .sort((a, b) => b.e.fecha.localeCompare(a.e.fecha) || b.i - a.i)
    .map(({ e }) => e);

  return (
    <>
      <Cabecera
        titulo="Evaluaciones"
        subtitulo={`${pendientes.length} pendientes · puntuaciones de 1 a 5`}
        accion={<EnlaceBoton href="/demo/evaluaciones/nueva" className="shrink-0">Nueva</EnlaceBoton>}
      />

      {pendientes.length > 0 ? (
        <Lista etiqueta="Evaluaciones pendientes">
          {pendientes.map((e) => (
            <FilaPendiente key={e.id} pendiente={e} />
          ))}
        </Lista>
      ) : (
        <Vacio>No hay evaluaciones pendientes.</Vacio>
      )}

      <Seccion titulo="Realizadas">
        <Lista etiqueta="Evaluaciones realizadas">
          {realizadas.map((e) => (
            <FilaRealizada key={e.id} evaluacion={e} />
          ))}
        </Lista>
      </Seccion>
    </>
  );
}
