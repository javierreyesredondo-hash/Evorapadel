import type { Metadata } from "next";
import { Suspense } from "react";
import { estadoCadena, siguientePendiente } from "@/lib/cadena";
import { hoyIso } from "@/lib/format";
import { esUuid } from "@/lib/gestion";
import { escalaDescrita } from "@/lib/redaccion";
import { ESCALA_NOTAS } from "@/lib/metodologia";
import { contextoEscuela, obtenerGrupo } from "@/lib/supabase/gestion";
import { evaluacionesDelDia, listarCompetencias, puedeEditar } from "@/lib/supabase/evaluaciones";
import { metodologiaActiva } from "@/lib/supabase/metodologias";
import { EnlaceBoton, Vacio } from "@/components/ui";
import { Cargando, ErrorCarga, NoEncontrado } from "@/components/gestion/Estados";
import { EvaluacionEnCadena } from "@/components/evaluaciones/EvaluacionEnCadena";

// Evaluación en cadena de un grupo: todos sus jugadores activos, hoy, uno tras
// otro. El estado (quién está evaluado) sale de la base de datos en cada visita.

export const metadata: Metadata = { title: "Evaluar el grupo" };

export default function Page(props: PageProps<"/entrenamiento/evaluar/[grupo]">) {
  return (
    <Suspense fallback={<Cargando texto="Preparando la evaluación del grupo…" />}>
      <Contenido params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Contenido({
  params,
  searchParams,
}: {
  params: Promise<{ grupo: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ grupo: grupoId }, query] = await Promise.all([params, searchParams]);
  const ctx = await contextoEscuela();
  if (!ctx) return <ErrorCarga />;
  const hoy = hoyIso();
  const [grupo, competencias, activa, delDia] = await Promise.all([
    obtenerGrupo(ctx, grupoId),
    listarCompetencias(ctx),
    metodologiaActiva(ctx),
    evaluacionesDelDia(ctx, grupoId, hoy),
  ]);
  if (!grupo.ok) return <ErrorCarga mensaje={grupo.mensaje} />;
  if (!grupo.datos) return <NoEncontrado titulo="Grupo no encontrado" volver={{ href: "/entrenamiento", texto: "Mi entrenamiento" }} />;
  if (!competencias.ok) return <ErrorCarga mensaje={competencias.mensaje} />;
  if (!activa.ok) return <ErrorCarga mensaje={activa.mensaje} />;
  if (!delDia.ok) return <ErrorCarga mensaje={delDia.mensaje} />;

  const g = grupo.datos;
  const titulo = (
    <header className="mb-5">
      <p className="text-xs font-bold uppercase tracking-wide text-electrico">Evaluación en cadena · hoy</p>
      <h1 className="font-display text-4xl font-extrabold uppercase italic leading-none tracking-tight">{g.nombre}</h1>
    </header>
  );
  const activas = competencias.datos.filter((c) => c.activa);
  if (activas.length === 0) {
    return (
      <>
        {titulo}
        <Vacio>
          Tu escuela todavía no tiene metodología (competencias que evaluar).{" "}
          {ctx.rol === "director" ? "Defínela primero." : "Pide a la dirección que la defina."}
        </Vacio>
      </>
    );
  }

  const jugadores = g.jugadores
    .filter((j) => j.activo)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    .map(({ id, nombre }) => ({ id, nombre }));
  const estado = estadoCadena(jugadores, delDia.datos);
  // El jugador de la URL (si es del grupo) o el primero pendiente.
  const pedido = typeof query.jugador === "string" && esUuid(query.jugador) ? jugadores.find((j) => j.id === query.jugador) : undefined;
  const actual = pedido ?? siguientePendiente(estado, null);
  const editables = delDia.datos.filter((e) => puedeEditar(ctx, e)).map((e) => e.id);

  return (
    <>
      {titulo}
      <EvaluacionEnCadena
        grupo={{ id: g.id, nombre: g.nombre }}
        estado={estado}
        actualId={actual?.id ?? null}
        competencias={activas}
        escala={activa.datos?.niveles ?? escalaDescrita(ESCALA_NOTAS)}
        editables={editables}
        metodologia={activa.datos ? { nombre: activa.datos.nombre, version: activa.datos.version } : null}
      />
      <div className="mt-8">
        <EnlaceBoton href="/entrenamiento" variante="secundario">
          Salir (lo guardado se conserva)
        </EnlaceBoton>
      </div>
    </>
  );
}
