import type { ReactNode } from "react";
import { textoFecha } from "@/lib/format";
import { NIVEL_TEXTO, type NivelBD } from "@/lib/gestion";
import { textoDiferencia, textoMediaEvaluacion, TIPO_TEXTO } from "@/lib/evaluaciones";
import { TEXTO_SIN_ENTRENADOR, textoSinComparacion, type InformeEvaluacion } from "@/lib/informe";
import { AREA_TEXTO, ESCALA_NOTAS } from "@/lib/metodologia";

// Contenido de una evaluación a partir del MISMO modelo que el PDF
// (src/lib/informe.ts). «app»: estilo oscuro de la aplicación (ficha de la
// evaluación). «papel»: previsualización con el aspecto del documento.

type Variante = "app" | "papel";

const estilos = {
  app: {
    caja: "",
    texto: "text-blanco",
    tenue: "text-tenue",
    datos: "bg-noche-700 ring-1 ring-noche-500",
    vacio: "bg-noche-500",
    lleno: "bg-electrico",
    linea: "divide-noche-500",
    cabeceraTabla: "bg-noche-600 text-blanco",
  },
  papel: {
    caja: "overflow-hidden rounded-2xl bg-blanco text-noche shadow-lg",
    texto: "text-noche",
    tenue: "text-[#5b6b82]",
    datos: "bg-[#f2f5f9]",
    vacio: "bg-[#e3e8ef]",
    lleno: "bg-electrico ring-1 ring-noche",
    linea: "divide-[#d5dce6]",
    cabeceraTabla: "bg-noche text-blanco",
  },
} as const;

function Seccion({ titulo, variante, children }: { titulo: string; variante: Variante; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className={`flex items-center gap-2 font-display text-lg font-extrabold uppercase italic ${estilos[variante].texto}`}>
        <span aria-hidden="true" className="h-4 w-1 bg-electrico ring-1 ring-noche" />
        {titulo}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/** Texto del entrenador conservando párrafos. */
function Parrafos({ texto, clase }: { texto: string; clase: string }) {
  return (
    <div className={`space-y-2 text-sm leading-relaxed ${clase}`}>
      {texto.split(/\n{2,}/).map((p, i) => (
        <p key={i} className="whitespace-pre-line break-words">
          {p}
        </p>
      ))}
    </div>
  );
}

export function VistaInforme({ informe: m, variante = "app" }: { informe: InformeEvaluacion; variante?: Variante }) {
  const e = estilos[variante];
  const fecha = textoFecha(m.fecha);
  const contenido = (
    <>
      <header>
        <h1 className={`font-display text-3xl font-extrabold italic leading-tight break-words ${e.texto}`}>{m.jugador.nombre}</h1>
        <p className={`mt-1 text-sm font-semibold ${e.tenue}`}>{[TIPO_TEXTO[m.tipo], fecha, m.titulo].filter(Boolean).join(" · ")}</p>
      </header>

      <dl className={`mt-4 grid grid-cols-2 gap-3 rounded-2xl p-4 ${e.datos}`}>
        {(
          [
            ["Grupo", m.grupo ?? "Sin grupo"],
            ["Nivel", m.jugador.nivel ? (NIVEL_TEXTO[m.jugador.nivel as NivelBD] ?? m.jugador.nivel) : "Sin indicar"],
            ["Entrenador/a", m.entrenador ?? TEXTO_SIN_ENTRENADOR],
            ["Fecha", fecha],
          ] as const
        ).map(([etiqueta, valor]) => (
          <div key={etiqueta} className="min-w-0">
            <dt className={`text-[10px] font-bold uppercase tracking-wider ${e.tenue}`}>{etiqueta}</dt>
            <dd className={`break-words font-semibold ${e.texto}`}>{valor}</dd>
          </div>
        ))}
      </dl>

      <Seccion titulo="Competencias evaluadas" variante={variante}>
        <p className={`font-bold ${e.texto}`}>
          Media {textoMediaEvaluacion(m.media)} / 5 · {m.puntuaciones.length}{" "}
          {m.puntuaciones.length === 1 ? "competencia evaluada" : "competencias evaluadas"}
        </p>
        <ul aria-label="Puntuaciones" className={`mt-2 divide-y ${e.linea}`}>
          {m.puntuaciones.map((p) => (
            <li key={p.competenciaId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
              <div className="min-w-0">
                <p className={`font-semibold ${e.texto}`}>{p.nombre}</p>
                <p className={`text-xs ${e.tenue}`}>{AREA_TEXTO[p.area]}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex gap-1" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span key={i} className={`h-2.5 w-6 ${i <= p.puntuacion ? e.lleno : e.vacio}`} />
                  ))}
                </span>
                <span className={`w-32 text-sm font-semibold ${e.texto}`}>
                  {p.puntuacion} · {ESCALA_NOTAS[p.puntuacion]}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <p className={`mt-2 text-xs ${e.tenue}`}>
          Escala: {Object.entries(ESCALA_NOTAS).map(([n, t]) => `${n} ${t}`).join(" · ")}.
        </p>
      </Seccion>

      {m.fortalezas && (
        <Seccion titulo="Fortalezas" variante={variante}>
          <Parrafos texto={m.fortalezas} clase={e.texto} />
        </Seccion>
      )}
      {m.mejoras && (
        <Seccion titulo="Áreas prioritarias de mejora" variante={variante}>
          <Parrafos texto={m.mejoras} clase={e.texto} />
        </Seccion>
      )}
      {m.objetivos.length > 0 && (
        <Seccion titulo="Objetivos de mejora" variante={variante}>
          <ul className={`list-disc space-y-2 pl-5 text-sm ${e.texto}`}>
            {m.objetivos.map((o, i) => (
              <li key={i} className="break-words">
                {o.descripcion}
                {o.plazo && <span className={`block text-xs font-semibold ${e.tenue}`}>Plazo: {textoFecha(o.plazo)}</span>}
              </li>
            ))}
          </ul>
        </Seccion>
      )}
      {m.observaciones && (
        <Seccion titulo="Observaciones del entrenador/a" variante={variante}>
          <Parrafos texto={m.observaciones} clase={e.texto} />
        </Seccion>
      )}

      <Seccion titulo="Evolución" variante={variante}>
        {!m.comparacion ? (
          <p className={`text-sm ${e.texto}`}>{textoSinComparacion(m)}</p>
        ) : (
          <>
            <p className={`text-sm ${e.texto}`}>
              Comparación con la evaluación anterior del mismo tipo ({textoFecha(m.comparacion.fechaAnterior)}), solo en las
              competencias puntuadas en ambas.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className={`w-full text-left text-sm ${e.texto}`}>
                <caption className="sr-only">Evolución por competencia</caption>
                <thead className={e.cabeceraTabla}>
                  <tr>
                    <th scope="col" className="px-3 py-2 font-bold">Competencia</th>
                    <th scope="col" className="px-2 py-2 text-center font-bold">Anterior</th>
                    <th scope="col" className="px-2 py-2 text-center font-bold">Actual</th>
                    <th scope="col" className="px-2 py-2 text-center font-bold">Cambio</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${e.linea}`}>
                  {m.comparacion.filas.map((f) => (
                    <tr key={f.competenciaId}>
                      <td className="px-3 py-2">{f.nombre}</td>
                      <td className="px-2 py-2 text-center">{f.anterior}</td>
                      <td className="px-2 py-2 text-center">{f.actual}</td>
                      <td className="px-2 py-2 text-center">
                        <span
                          className={`inline-block min-w-8 px-1.5 font-bold ${
                            f.diferencia > 0 ? "bg-electrico text-noche" : f.diferencia < 0 ? "bg-naranja text-noche" : e.tenue
                          }`}
                        >
                          {textoDiferencia(f.diferencia)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={`mt-2 text-sm font-semibold ${e.texto}`}>
              Media de las competencias comparadas: de {textoMediaEvaluacion(m.comparacion.mediaAnterior)} a{" "}
              {textoMediaEvaluacion(m.comparacion.mediaActual)}.
            </p>
            {m.comparacion.sinComparar > 0 && (
              <p className={`text-xs ${e.tenue}`}>
                {m.comparacion.sinComparar}{" "}
                {m.comparacion.sinComparar === 1
                  ? "competencia de esta evaluación no se puntuó en la anterior y no se compara."
                  : "competencias de esta evaluación no se puntuaron en la anterior y no se comparan."}
              </p>
            )}
          </>
        )}
      </Seccion>
    </>
  );

  if (variante === "app") return <article>{contenido}</article>;

  return (
    <article aria-label="Vista previa del informe" className={e.caja}>
      <div className="flex flex-wrap items-start justify-between gap-3 bg-noche px-5 py-5 text-blanco">
        <div>
          <p className="font-display text-3xl font-extrabold italic leading-none">
            ÉVORA <span className="text-sm text-electrico">PADEL</span>
          </p>
          <p className="mt-2 text-xs font-semibold text-electrico">Observa. Mide. Haz crecer.</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-electrico">Informe de evaluación</p>
          <p className="break-words font-bold">{m.escuela}</p>
        </div>
      </div>
      <div className="px-5 py-5">{contenido}</div>
      <p className="border-t border-[#d5dce6] px-5 py-3 text-[11px] text-[#5b6b82]">
        Emitido el {textoFecha(m.emitido)} · Documento privado: compártelo solo con el jugador y su familia.
      </p>
    </article>
  );
}
