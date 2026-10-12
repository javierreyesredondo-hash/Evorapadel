"use client";

import { useAlmacen } from "@/lib/almacen";
import { objetivoCompletado } from "@/lib/dominio";
import { Cabecera, EnlaceBoton, Lista, Seccion, Vacio } from "@/components/ui";
import { FilaObjetivo } from "@/components/FilaObjetivo";

export function Objetivos() {
  const { estado } = useAlmacen();
  const activos = estado.objetivos.filter((o) => !objetivoCompletado(o));
  const completados = estado.objetivos.filter(objetivoCompletado);

  return (
    <>
      <Cabecera
        titulo="Objetivos"
        subtitulo={`${activos.length} en curso · ${completados.length} completados`}
        accion={<EnlaceBoton href="/demo/objetivos/nuevo" className="shrink-0">Nuevo</EnlaceBoton>}
      />
      {activos.length > 0 ? (
        <Lista etiqueta="Objetivos en curso">
          {activos.map((o) => (
            <FilaObjetivo key={o.id} objetivo={o} />
          ))}
        </Lista>
      ) : (
        <Vacio>No hay objetivos en curso.</Vacio>
      )}
      {completados.length > 0 && (
        <Seccion titulo="Completados">
          <Lista etiqueta="Objetivos completados">
            {completados.map((o) => (
              <FilaObjetivo key={o.id} objetivo={o} />
            ))}
          </Lista>
        </Seccion>
      )}
    </>
  );
}
