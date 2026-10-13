import type { Metadata } from "next";
import { Suspense } from "react";
import { textoFecha } from "@/lib/format";
import { competenciasEvaluables } from "@/lib/metodologias/modelo";
import { contextoEscuela } from "@/lib/supabase/gestion";
import { metodologiaActiva, obtenerMetodologia } from "@/lib/supabase/metodologias";
import { EnlaceBoton } from "@/components/ui";
import { Cargando, Datos, ErrorCarga, NoEncontrado } from "@/components/gestion/Estados";
import { AccionesMetodologia } from "@/components/metodologias/Acciones";
import { ESTADO_TEXTO, VistaMetodologia } from "@/components/metodologias/VistaMetodologia";

export const metadata: Metadata = { title: "Metodología importada" };

export default function Page(props: PageProps<"/metodologia/importadas/[id]">) {
  return (
    <Suspense fallback={<Cargando texto="Cargando metodología…" />}>
      <Contenido params={props.params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contextoEscuela();
  if (!ctx) return <ErrorCarga />;
  const [r, activa] = await Promise.all([obtenerMetodologia(ctx, id), metodologiaActiva(ctx)]);
  if (!r.ok) return <ErrorCarga mensaje={r.mensaje} />;
  const m = r.datos;
  if (!m) return <NoEncontrado titulo="Metodología no encontrada" volver={{ href: "/metodologia", texto: "Ver metodología" }} />;
  const otraActiva = activa.ok && activa.datos && activa.datos.id !== m.id ? activa.datos : null;

  return (
    <>
      <header>
        <p className="text-xs font-bold uppercase tracking-wide text-electrico">{ESTADO_TEXTO[m.estado]}</p>
        <h1 className="mt-1 font-display text-4xl font-extrabold uppercase italic leading-none tracking-tight">{m.nombre}</h1>
        <p className="mt-2 text-sm text-tenue">Versión {m.version}</p>
        {m.descripcion && <p className="mt-3 text-sm text-blanco/80">{m.descripcion}</p>}
      </header>

      <div className="mt-5">
        <Datos
          filas={[
            ["Importada", textoFecha(m.creada.slice(0, 10))],
            ["Activada", m.activada ? textoFecha(m.activada.slice(0, 10)) : "—"],
            ["Documento", m.documento ? `${m.documento.nombre}${m.documento.paginas ? ` · ${m.documento.paginas} pág.` : ""}` : "—"],
          ]}
        />
      </div>

      {ctx.rol === "director" && (
        <div className="mt-5">
          <AccionesMetodologia
            id={m.id}
            nombre={`${m.nombre} ${m.version}`}
            estado={m.estado}
            evaluables={competenciasEvaluables(m.contenido).length}
            activa={otraActiva ? { nombre: otraActiva.nombre, version: otraActiva.version } : null}
          />
        </div>
      )}
      {m.estado === "activa" && (
        <p className="mt-5 rounded-xl bg-noche-700 px-3 py-2 text-sm ring-1 ring-noche-500">
          Es la metodología activa: las evaluaciones nuevas usan sus competencias y su escala. Para cambiarla, importa una
          versión nueva.
        </p>
      )}

      <div className="mt-8">
        <VistaMetodologia contenido={m.contenido} />
      </div>
      <div className="mt-8">
        <EnlaceBoton href="/metodologia" variante="secundario">
          Volver a metodología
        </EnlaceBoton>
      </div>
    </>
  );
}
