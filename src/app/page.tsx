import Link from "next/link";
import { evaluaciones, jugadores, objetivos } from "@/lib/demo-data";
import {
  FilaEvaluacion,
  FilaJugador,
  FilaObjetivo,
  Lista,
  Seccion,
} from "@/components/ui";

export default function Inicio() {
  const pendientesUrgentes = evaluaciones.filter((e) => e.venceEnDias <= 0).length;
  const destacados = [...jugadores]
    .sort((a, b) => b.tendencia - a.tendencia)
    .slice(0, 3);

  const datos = [
    { valor: jugadores.length, texto: "Jugadores", href: "/jugadores" },
    { valor: evaluaciones.length, texto: "Evaluaciones pendientes", href: "/evaluaciones" },
    { valor: objetivos.length, texto: "Objetivos activos", href: "/objetivos" },
  ];

  return (
    <>
      <section className="relative overflow-hidden rounded-3xl bg-electrico p-5 text-noche">
        <p className="text-sm font-semibold">Hola, entrenador</p>
        <h1 className="mt-1 font-display text-4xl font-extrabold uppercase italic leading-[0.95] tracking-tight sm:text-5xl">
          Observa.
          <br />
          Mide.
          <br />
          Haz crecer.
        </h1>
        {pendientesUrgentes > 0 && (
          <Link
            href="/evaluaciones"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-noche px-4 py-2 text-sm font-bold text-blanco"
          >
            <span className="size-2 rounded-full bg-naranja" aria-hidden="true" />
            {pendientesUrgentes} evaluaciones urgentes
          </Link>
        )}
        <span
          aria-hidden="true"
          className="absolute -right-8 -top-8 size-32 rounded-full border-[14px] border-noche/10"
        />
      </section>

      <ul className="mt-4 grid grid-cols-3 gap-3">
        {datos.map((d) => (
          <li key={d.href}>
            <Link
              href={d.href}
              className="block h-full rounded-2xl bg-noche-700 p-3 ring-1 ring-noche-500 transition-colors hover:ring-electrico"
            >
              <p className="font-display text-3xl font-bold leading-none">{d.valor}</p>
              <p className="mt-1 text-xs leading-tight text-tenue">{d.texto}</p>
            </Link>
          </li>
        ))}
      </ul>

      <Seccion titulo="Evaluaciones pendientes" enlace={{ href: "/evaluaciones", texto: "Ver todas" }}>
        <Lista>
          {evaluaciones.slice(0, 3).map((e) => (
            <FilaEvaluacion key={e.id} evaluacion={e} />
          ))}
        </Lista>
      </Seccion>

      <Seccion titulo="Objetivos" enlace={{ href: "/objetivos", texto: "Ver todos" }}>
        <Lista>
          {objetivos.slice(0, 3).map((o) => (
            <FilaObjetivo key={o.id} objetivo={o} />
          ))}
        </Lista>
      </Seccion>

      <Seccion titulo="Más progreso" enlace={{ href: "/jugadores", texto: "Jugadores" }}>
        <Lista>
          {destacados.map((j) => (
            <FilaJugador key={j.id} jugador={j} />
          ))}
        </Lista>
      </Seccion>
    </>
  );
}
