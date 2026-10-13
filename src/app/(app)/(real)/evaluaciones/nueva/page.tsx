import type { Metadata } from "next";
import { Suspense } from "react";
import { hoyIso } from "@/lib/format";
import { esUuid } from "@/lib/gestion";
import { contextoEscuela, listarJugadores } from "@/lib/supabase/gestion";
import { listarCompetencias } from "@/lib/supabase/evaluaciones";
import { Cabecera, EnlaceBoton, Vacio } from "@/components/ui";
import { Cargando, ErrorCarga } from "@/components/gestion/Estados";
import { FormularioEvaluacionReal } from "@/components/evaluaciones/FormularioEvaluacionReal";

export const metadata: Metadata = { title: "Nueva evaluación" };

export default function Page(props: PageProps<"/evaluaciones/nueva">) {
  return (
    <>
      <Cabecera titulo="Nueva evaluación" subtitulo="Se guardará en tu escuela." />
      <Suspense fallback={<Cargando texto="Preparando el formulario…" />}>
        <Contenido searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Contenido({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const ctx = await contextoEscuela();
  if (!ctx) return <ErrorCarga />;
  const [jugadores, competencias] = await Promise.all([listarJugadores(ctx), listarCompetencias(ctx)]);
  if (!jugadores.ok) return <ErrorCarga mensaje={jugadores.mensaje} />;
  if (!competencias.ok) return <ErrorCarga mensaje={competencias.mensaje} />;

  const activas = competencias.datos.filter((c) => c.activa);
  if (activas.length === 0) {
    return (
      <Vacio>
        Tu escuela todavía no tiene metodología (competencias que evaluar).{" "}
        {ctx.rol === "director" ? "Defínela primero." : "Pide a la dirección que la defina."}
        {ctx.rol === "director" && (
          <span className="mt-4 block">
            <EnlaceBoton href="/metodologia">Ir a Metodología</EnlaceBoton>
          </span>
        )}
      </Vacio>
    );
  }
  const evaluables = jugadores.datos.filter((j) => j.activo).map((j) => ({ id: j.id, nombre: j.nombre, grupos: j.grupos }));
  if (evaluables.length === 0) return <Vacio>No hay jugadores activos en tu escuela.</Vacio>;

  // El jugador y el tipo pueden venir en la URL (desde la ficha); se validan aquí.
  const pedido = typeof params.jugador === "string" && esUuid(params.jugador) ? evaluables.find((j) => j.id === params.jugador) : undefined;
  const hoy = hoyIso();
  return (
    <FormularioEvaluacionReal
      jugadores={evaluables}
      competencias={activas}
      hoy={hoy}
      inicial={{
        jugadorId: pedido?.id ?? "",
        tipo: params.tipo === "completa" ? "completa" : "rapida",
        fecha: hoy,
        grupoId: pedido?.grupos[0]?.id ?? "",
        titulo: "",
        fortalezas: "",
        mejoras: "",
        observaciones: "",
        notas: {},
        objetivos: [],
      }}
    />
  );
}
