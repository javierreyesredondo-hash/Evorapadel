import type { Metadata } from "next";
import { Suspense } from "react";
import { hoyIso } from "@/lib/format";
import { contextoEscuela, listarJugadores } from "@/lib/supabase/gestion";
import { listarCompetencias, obtenerEvaluacion, puedeEditar } from "@/lib/supabase/evaluaciones";
import { metodologiaActiva } from "@/lib/supabase/metodologias";
import { escalaDe } from "@/lib/metodologia";
import { Cabecera } from "@/components/ui";
import { Cargando, ErrorCarga, NoEncontrado, SoloDireccion } from "@/components/gestion/Estados";
import { FormularioEvaluacionReal } from "@/components/evaluaciones/FormularioEvaluacionReal";

export const metadata: Metadata = { title: "Editar evaluación" };

export default function Page(props: PageProps<"/evaluaciones/[id]/editar">) {
  return (
    <Suspense fallback={<Cargando texto="Cargando evaluación…" />}>
      <Contenido params={props.params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contextoEscuela();
  if (!ctx) return <ErrorCarga />;
  const [r, competencias, jugadores, activa] = await Promise.all([
    obtenerEvaluacion(ctx, id),
    listarCompetencias(ctx),
    listarJugadores(ctx),
    metodologiaActiva(ctx),
  ]);
  if (!r.ok) return <ErrorCarga mensaje={r.mensaje} />;
  const ev = r.datos;
  if (!ev) return <NoEncontrado titulo="Evaluación no encontrada" volver={{ href: "/evaluaciones", texto: "Ver evaluaciones" }} />;
  if (!puedeEditar(ctx, ev)) return <SoloDireccion>Solo quien hizo la evaluación o la dirección pueden editarla.</SoloDireccion>;
  if (!competencias.ok) return <ErrorCarga mensaje={competencias.mensaje} />;

  if (!activa.ok) return <ErrorCarga mensaje={activa.mensaje} />;

  // Se edita con la versión de metodología con la que se hizo: si después se
  // activó otra, solo se ofrecen las competencias que ya tenía (no se mezclan).
  const previas = new Set(ev.puntuaciones.map((p) => p.competenciaId));
  const mismaVersion = (ev.metodologia?.id ?? null) === (activa.datos?.id ?? null);
  const permitidas = competencias.datos.filter((c) => previas.has(c.id) || (mismaVersion && c.activa));
  const grupos = jugadores.ok ? (jugadores.datos.find((j) => j.id === ev.jugador.id)?.grupos ?? []) : [];
  return (
    <>
      <Cabecera titulo="Editar evaluación" subtitulo={ev.jugador.nombre} />
      <FormularioEvaluacionReal
        jugadores={[{ id: ev.jugador.id, nombre: ev.jugador.nombre, grupos }]}
        competencias={permitidas}
        escala={escalaDe(ev.metodologia?.escala)}
        hoy={hoyIso()}
        inicial={{
          id: ev.id,
          jugadorId: ev.jugador.id,
          tipo: ev.tipo,
          fecha: ev.fecha,
          grupoId: ev.grupo?.id ?? "",
          titulo: ev.titulo ?? "",
          fortalezas: ev.fortalezas ?? "",
          mejoras: ev.mejoras ?? "",
          observaciones: ev.observaciones ?? "",
          notas: Object.fromEntries(ev.puntuaciones.map((p) => [p.competenciaId, String(p.puntuacion)])),
          objetivos: ev.objetivos,
        }}
      />
    </>
  );
}
