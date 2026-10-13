"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type ReactNode } from "react";
import { guardarMetodologiaImportada } from "@/app/acciones-metodologias";
import {
  CATEGORIA_TEXTO,
  LIMITES_IMPORTACION,
  type Aviso,
  type CategoriaSeccion,
  type Documento,
  type Propuesta,
} from "@/lib/metodologias/modelo";
import { claseBoton } from "@/components/ui";
import { claseCampo } from "@/components/campos";

// Importar una metodología desde PDF en dos pasos:
//   1. Analizar: el PDF va al servidor de ÉVORA (nunca a servicios externos),
//      que devuelve una PROPUESTA sin guardar nada.
//   2. Revisar: la dirección corrige, descarta o añade lo que falte y la guarda
//      como BORRADOR. Activarla es otro paso, en la ficha de la metodología.

type Analisis = { propuesta: Propuesta; documento: Documento; duplicado: { id: string; nombre: string; version: string } | null };

const MB = (LIMITES_IMPORTACION.pdfBytes / 1024 / 1024).toFixed(0);

export function Importador() {
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  if (!analisis) return <SubirPdf alAnalizar={setAnalisis} />;
  return <Revision inicial={analisis} alDescartar={() => setAnalisis(null)} />;
}

// ------------------------------------------------------------------ paso 1

function SubirPdf({ alAnalizar }: { alAnalizar: (a: Analisis) => void }) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (pendiente) return;
    const archivo = new FormData(evento.currentTarget).get("archivo");
    if (!(archivo instanceof File) || archivo.size === 0) return setError("Elige un archivo PDF.");
    if (archivo.size > LIMITES_IMPORTACION.pdfBytes) return setError(`El PDF supera el tamaño máximo (${MB} MB).`);
    if (archivo.type !== "application/pdf" && !/\.pdf$/i.test(archivo.name)) return setError("Elige un archivo PDF.");
    setError(null);
    setPendiente(true);
    try {
      const datos = new FormData();
      datos.set("archivo", archivo);
      const r = await fetch("/metodologia/importar/analizar", { method: "POST", body: datos });
      const cuerpo = (await r.json().catch(() => null)) as (Analisis & { error?: string }) | null;
      if (!r.ok || !cuerpo?.propuesta) setError(cuerpo?.error ?? "No se ha podido analizar el PDF. Inténtalo de nuevo.");
      else alAnalizar(cuerpo);
    } catch {
      setError("No se ha podido conectar. Comprueba tu conexión e inténtalo de nuevo.");
    } finally {
      setPendiente(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4 rounded-2xl bg-noche-700 p-4 ring-1 ring-noche-500">
      <div>
        <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
          Documento de la metodología (PDF)
        </label>
        <input
          id={id}
          name="archivo"
          type="file"
          accept="application/pdf,.pdf"
          aria-invalid={!!error}
          aria-describedby={`${id}-ayuda${error ? ` ${id}-error` : ""}`}
          className="block min-h-11 w-full text-sm file:mr-3 file:min-h-11 file:rounded-full file:border-0 file:bg-noche-500 file:px-4 file:font-bold file:text-blanco"
        />
        <p id={`${id}-ayuda`} className="mt-1 text-xs text-tenue">
          PDF con texto (no escaneado), hasta {MB} MB y {LIMITES_IMPORTACION.pdfPaginas} páginas. Se analiza en el servidor de
          ÉVORA, no se envía a ningún servicio externo y no se guarda el archivo: solo su nombre y su huella para evitar
          duplicados.
        </p>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm font-semibold text-naranja">
          {error}
        </p>
      )}
      <button type="submit" disabled={pendiente} className={claseBoton.primario}>
        {pendiente ? "Analizando el PDF…" : "Analizar PDF"}
      </button>
      {pendiente && (
        <p role="status" className="text-sm text-tenue">
          Leyendo el documento. Puede tardar unos segundos.
        </p>
      )}
    </form>
  );
}

// ------------------------------------------------------------------ paso 2

type Editar = (cambio: (p: Propuesta) => void) => void;

const claseCasilla = "flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold";
const claseArea = `${claseCampo} h-auto py-3`;

function Revision({ inicial, alDescartar }: { inicial: Analisis; alDescartar: () => void }) {
  const router = useRouter();
  const [p, setP] = useState<Propuesta>(inicial.propuesta);
  const [errores, setErrores] = useState<string[]>([]);
  const [pendiente, iniciar] = useTransition();
  const erroresRef = useRef<HTMLDivElement>(null);
  const { documento, duplicado } = inicial;

  const editar: Editar = (cambio) =>
    setP((anterior) => {
      const copia = structuredClone(anterior);
      cambio(copia);
      return copia;
    });

  function guardar() {
    if (pendiente) return;
    setErrores([]);
    iniciar(async () => {
      try {
        const r = await guardarMetodologiaImportada(JSON.stringify(p), JSON.stringify(documento));
        if (r.ok) return router.push(`/metodologia/importadas/${r.id}`);
        setErrores(r.errores);
      } catch {
        setErrores(["No se ha podido conectar. Comprueba tu conexión e inténtalo de nuevo."]);
      }
      requestAnimationFrame(() => erroresRef.current?.focus());
    });
  }

  const grupos = agrupar(p.competencias.map((c, i) => ({ c, i })), (x) => x.c.grupo || "Sin grupo");
  const categorias = resumenCategorias(p);

  return (
    <div className="space-y-8">
      <div className="rounded-2xl bg-noche-700 p-4 text-sm ring-1 ring-noche-500">
        <p>
          <strong>{documento.nombre}</strong> · {documento.paginas} {documento.paginas === 1 ? "página" : "páginas"} ·{" "}
          {(documento.bytes / 1024).toFixed(0)} KB
        </p>
        <p className="mt-1 text-tenue">
          Esto es lo que se ha encontrado en el PDF. Revísalo: corrige lo que esté mal, desmarca lo que no quieras guardar y
          añade lo que falte. Nada se guarda hasta que pulses «Guardar como borrador», y la metodología no se activa sola.
        </p>
      </div>

      {duplicado && (
        <p role="alert" className="rounded-2xl border border-naranja/40 bg-naranja/10 p-4 text-sm text-naranja">
          Este PDF ya está importado como «{duplicado.nombre}» versión {duplicado.version}. No se puede guardar dos veces.{" "}
          <a href={`/metodologia/importadas/${duplicado.id}`} className="font-bold underline">
            Ver la metodología importada
          </a>
        </p>
      )}

      <nav aria-label="Contenido encontrado" className="rounded-2xl bg-noche-700 p-4 ring-1 ring-noche-500">
        <h2 className="text-sm font-bold">Contenido encontrado</h2>
        <ul className="mt-2 grid gap-x-4 text-sm sm:grid-cols-2">
          <Indice href="#rev-datos" texto="Datos generales" />
          <Indice href="#rev-fases" texto="Fases" n={p.fases.length} />
          <Indice href="#rev-principios" texto="Principios" n={p.principios.length} />
          <Indice href="#rev-escala" texto="Escala y niveles" n={p.escala.length} />
          <Indice href="#rev-competencias" texto="Áreas, competencias e indicadores" n={p.competencias.length} />
          <Indice href="#rev-fichas" texto="Fichas y campos" n={p.fichas.length} />
          {categorias.map(([cat, n]) => (
            <Indice key={cat} href="#rev-fichas" texto={CATEGORIA_TEXTO[cat]} n={n} />
          ))}
          <Indice href="#rev-textos" texto="Textos de la metodología" n={p.textos.length} />
          <Indice href="#rev-no-interpretado" texto="No interpretado" n={p.noInterpretado.length} aviso />
        </ul>
      </nav>

      <NoInterpretado avisos={p.noInterpretado} />

      <Bloque id="rev-datos" titulo="Datos generales">
        <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
          <Texto etiqueta="Nombre" valor={p.nombre} max={LIMITES_IMPORTACION.nombre} alCambiar={(v) => editar((x) => void (x.nombre = v))} />
          <Texto etiqueta="Versión" valor={p.version} max={LIMITES_IMPORTACION.version} alCambiar={(v) => editar((x) => void (x.version = v))} />
        </div>
        <Texto etiqueta="Descripción" valor={p.descripcion} max={LIMITES_IMPORTACION.descripcion} area alCambiar={(v) => editar((x) => void (x.descripcion = v))} />
      </Bloque>

      <Bloque id="rev-fases" titulo="Fases del método">
        {p.fases.length === 0 && <p className="text-sm text-tenue">No se han encontrado fases en el texto del PDF.</p>}
        <ul className="space-y-3">
          {p.fases.map((f, i) => (
            <Tarjeta key={i} incluir={f.incluir} etiqueta={`fase ${f.nombre || i + 1}`} pagina={f.pagina} alIncluir={(v) => editar((x) => void (x.fases[i].incluir = v))}>
              <div className="grid gap-3 sm:grid-cols-[5rem_1fr]">
                <Texto etiqueta="Nº" valor={f.numero === null ? "" : String(f.numero)} max={3} numero alCambiar={(v) => editar((x) => void (x.fases[i].numero = v === "" ? null : Number(v)))} />
                <Texto etiqueta="Fase" valor={f.nombre} max={LIMITES_IMPORTACION.titulo} alCambiar={(v) => editar((x) => void (x.fases[i].nombre = v))} />
              </div>
              <Texto etiqueta="Descripción" valor={f.descripcion} max={LIMITES_IMPORTACION.texto} area alCambiar={(v) => editar((x) => void (x.fases[i].descripcion = v))} />
            </Tarjeta>
          ))}
        </ul>
        <button
          type="button"
          disabled={p.fases.length >= LIMITES_IMPORTACION.fases}
          className={claseBoton.secundario}
          onClick={() =>
            editar((x) => {
              const ultimo = Math.max(0, ...x.fases.map((f) => f.numero ?? 0));
              x.fases.push({ numero: ultimo + 1, nombre: "", descripcion: "", pagina: null, incluir: true });
            })
          }
        >
          Añadir fase
        </button>
      </Bloque>

      <Bloque id="rev-principios" titulo="Principios">
        {p.principios.length === 0 && <p className="text-sm text-tenue">No se han encontrado principios.</p>}
        <ul className="space-y-3">
          {p.principios.map((x, i) => (
            <Tarjeta key={i} incluir={x.incluir} etiqueta={`principio ${x.nombre}`} pagina={x.pagina} alIncluir={(v) => editar((y) => void (y.principios[i].incluir = v))}>
              <Texto etiqueta="Principio" valor={x.nombre} max={LIMITES_IMPORTACION.titulo} alCambiar={(v) => editar((y) => void (y.principios[i].nombre = v))} />
              <Texto etiqueta="Descripción" valor={x.descripcion} max={LIMITES_IMPORTACION.texto} area alCambiar={(v) => editar((y) => void (y.principios[i].descripcion = v))} />
            </Tarjeta>
          ))}
        </ul>
      </Bloque>

      <Bloque id="rev-escala" titulo="Escala de evaluación">
        {p.escala.length === 0 ? (
          <p className="text-sm text-tenue">
            No se ha encontrado una escala de 1 a 5. Se usará la escala de ÉVORA (Inicial, En desarrollo, Competente,
            Avanzado, Excelente).
          </p>
        ) : (
          <>
            <p className="text-sm text-tenue">Las evaluaciones nuevas mostrarán estos nombres para cada nota.</p>
            <ul className="space-y-3">
              {p.escala.map((n, i) => (
                <li key={n.valor} className="rounded-2xl bg-noche p-3 ring-1 ring-noche-500">
                  <div className="grid gap-3 sm:grid-cols-[3rem_1fr]">
                    <p className="font-display text-3xl font-extrabold text-electrico" aria-hidden="true">
                      {n.valor}
                    </p>
                    <div className="space-y-3">
                      <Texto etiqueta={`Nivel ${n.valor}`} valor={n.nombre} max={40} alCambiar={(v) => editar((x) => void (x.escala[i].nombre = v))} />
                      <Texto etiqueta={`Descripción del nivel ${n.valor}`} valor={n.descripcion} max={LIMITES_IMPORTACION.texto} area alCambiar={(v) => editar((x) => void (x.escala[i].descripcion = v))} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Bloque>

      <Bloque id="rev-competencias" titulo="Áreas, competencias e indicadores">
        <p className="text-sm text-tenue">
          Se conservan las categorías y los indicadores del documento. Marca «Evaluar en ÉVORA» en los que quieras puntuar de 1
          a 5 en las evaluaciones (solo los que el documento puntúa). Los demás se guardan como indicadores de observación.
        </p>
        {grupos.map(([grupo, filas]) => (
          <fieldset key={grupo} className="rounded-2xl bg-noche p-3 ring-1 ring-noche-500">
            <legend className="px-1 font-display text-lg font-bold uppercase italic">{grupo}</legend>
            <ul className="divide-y divide-noche-500">
              {filas.map(({ c, i }) => (
                <li key={i} className={`py-2 ${c.incluir ? "" : "opacity-60"}`}>
                  <div className="flex flex-wrap items-center gap-x-4">
                    <Casilla etiqueta={`Incluir ${c.nombre} (${grupo})`} oculta marcada={c.incluir} alCambiar={(v) => editar((x) => void (x.competencias[i].incluir = v))} />
                    <div className="min-w-0 flex-1">
                      <Texto etiqueta={`Nombre del elemento ${i + 1} (${grupo})`} oculta valor={c.nombre} max={LIMITES_IMPORTACION.competenciaNombre} alCambiar={(v) => editar((x) => void (x.competencias[i].nombre = v))} />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 text-xs text-tenue">
                    {c.puntuable ? (
                      <Casilla
                        etiqueta="Evaluar en ÉVORA (1–5)"
                        etiquetaAccesible={`Evaluar ${c.nombre} (${grupo}) en ÉVORA de 1 a 5`}
                        marcada={c.evaluable}
                        desactivada={!c.incluir}
                        alCambiar={(v) => editar((x) => void (x.competencias[i].evaluable = v))}
                      />
                    ) : (
                      <span className="inline-flex min-h-11 items-center">Indicador de observación (sin escala en el documento)</span>
                    )}
                    <span>
                      {c.origen}
                      {c.pagina && ` · pág. ${c.pagina}`}
                    </span>
                  </div>
                  {c.descripcion && <p className="text-sm text-blanco/80">{c.descripcion}</p>}
                </li>
              ))}
            </ul>
          </fieldset>
        ))}
      </Bloque>

      <Bloque id="rev-fichas" titulo="Fichas y campos">
        {p.fichas.length === 0 && <p className="text-sm text-tenue">No se han encontrado fichas.</p>}
        {p.fichas.map((f, fi) => (
          <details key={fi} className="rounded-2xl bg-noche ring-1 ring-noche-500" open={fi === 0}>
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 py-2 font-bold">
              {f.numero !== null && <span className="text-electrico">Ficha {String(f.numero).padStart(2, "0")}</span>}
              <span className={f.incluir ? "" : "line-through opacity-60"}>{f.titulo}</span>
              {f.pagina && <span className="text-xs font-normal text-tenue">pág. {f.pagina}</span>}
            </summary>
            <div className="space-y-4 border-t border-noche-500 p-4">
              <Casilla etiqueta="Incluir esta ficha" marcada={f.incluir} alCambiar={(v) => editar((x) => void (x.fichas[fi].incluir = v))} />
              <Texto etiqueta="Título de la ficha" valor={f.titulo} max={LIMITES_IMPORTACION.titulo} alCambiar={(v) => editar((x) => void (x.fichas[fi].titulo = v))} />
              {f.descripcion && <p className="text-sm text-blanco/80">{f.descripcion}</p>}
              {f.secciones.map((s, si) => (
                <fieldset key={si} className={`rounded-xl p-3 ring-1 ring-noche-500 ${s.incluir && f.incluir ? "" : "opacity-60"}`}>
                  <legend className="px-1 text-sm font-bold">{s.titulo}</legend>
                  <div className="grid items-center gap-2 sm:grid-cols-[auto_1fr] sm:gap-4">
                    <Casilla etiqueta={`Incluir el apartado ${s.titulo}`} marcada={s.incluir} alCambiar={(v) => editar((x) => void (x.fichas[fi].secciones[si].incluir = v))} />
                    <SelectorCategoria
                      valor={s.categoria}
                      etiqueta={`Categoría de ${s.titulo}`}
                      alCambiar={(v) => editar((x) => void (x.fichas[fi].secciones[si].categoria = v))}
                    />
                  </div>
                  <ul className="mt-2 divide-y divide-noche-500">
                    {s.campos.map((c, ci) => (
                      <li key={ci} className={`py-2 ${c.incluir ? "" : "opacity-60"}`}>
                        <div className="flex flex-wrap items-center gap-x-3">
                          <Casilla etiqueta={`Incluir el campo ${c.etiqueta}`} oculta marcada={c.incluir} alCambiar={(v) => editar((x) => void (x.fichas[fi].secciones[si].campos[ci].incluir = v))} />
                          <span className="rounded-full bg-noche-600 px-2 py-0.5 text-xs font-bold">{TIPO_CAMPO[c.tipo]}</span>
                          <div className="min-w-0 flex-1">
                            <Texto etiqueta={`Campo ${ci + 1} de ${s.titulo}`} oculta valor={c.etiqueta} max={LIMITES_IMPORTACION.etiqueta} alCambiar={(v) => editar((x) => void (x.fichas[fi].secciones[si].campos[ci].etiqueta = v))} />
                          </div>
                        </div>
                        <DetalleCampo campo={c} />
                      </li>
                    ))}
                  </ul>
                </fieldset>
              ))}
            </div>
          </details>
        ))}
      </Bloque>

      <Bloque id="rev-textos" titulo="Textos de la metodología">
        {p.textos.length === 0 && <p className="text-sm text-tenue">No hay textos sueltos.</p>}
        <ul className="space-y-3">
          {p.textos.map((t, i) => (
            <Tarjeta key={i} incluir={t.incluir} etiqueta={`texto ${t.titulo}`} pagina={t.pagina} alIncluir={(v) => editar((x) => void (x.textos[i].incluir = v))}>
              <Texto etiqueta="Título" valor={t.titulo} max={LIMITES_IMPORTACION.titulo} alCambiar={(v) => editar((x) => void (x.textos[i].titulo = v))} />
              <Texto etiqueta="Texto" valor={t.texto} max={LIMITES_IMPORTACION.texto} area alCambiar={(v) => editar((x) => void (x.textos[i].texto = v))} />
            </Tarjeta>
          ))}
        </ul>
      </Bloque>

      <div className="space-y-3 rounded-2xl bg-noche-700 p-4 ring-1 ring-noche-500">
        {errores.length > 0 && (
          <div ref={erroresRef} tabIndex={-1} role="alert" className="text-sm font-semibold text-naranja focus:outline-none">
            <p>No se ha podido guardar:</p>
            <ul className="mt-1 list-disc pl-5">
              {errores.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={pendiente || !!duplicado} onClick={guardar} className={claseBoton.primario}>
            {pendiente ? "Guardando…" : "Guardar como borrador"}
          </button>
          <button
            type="button"
            disabled={pendiente}
            onClick={() => window.confirm("¿Descartar esta importación? Se perderán los cambios de la revisión.") && alDescartar()}
            className={claseBoton.secundario}
          >
            Descartar
          </button>
        </div>
        <p className="text-xs text-tenue">El borrador no cambia nada en las evaluaciones hasta que lo actives.</p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- piezas

const TIPO_CAMPO: Record<Propuesta["fichas"][number]["secciones"][number]["campos"][number]["tipo"], string> = {
  texto: "Texto",
  escala: "1–5",
  opciones: "Opciones",
  lista: "Lista",
  tabla: "Tabla",
  nota: "Nota",
};

function DetalleCampo({ campo: c }: { campo: Propuesta["fichas"][number]["secciones"][number]["campos"][number] }) {
  if (c.tipo === "opciones" && c.opciones?.length) return <p className="mt-1 text-xs text-tenue">☐ {c.opciones.join(" · ☐ ")}</p>;
  if (c.tipo === "lista" && c.elementos) return <p className="mt-1 text-xs text-tenue">{c.elementos} elementos</p>;
  if (c.tipo === "tabla" && c.columnas)
    return (
      <p className="mt-1 text-xs text-tenue">
        Columnas: {c.columnas.map((col) => col.titulo).join(", ")}
        {c.filas?.length ? ` · Filas: ${c.filas.join(", ")}` : ""}
      </p>
    );
  return null;
}

function Indice({ href, texto, n, aviso = false }: { href: string; texto: string; n?: number; aviso?: boolean }) {
  return (
    <li>
      <a href={href} className="flex min-h-11 items-center justify-between gap-2 hover:text-electrico">
        <span>{texto}</span>
        {n !== undefined && <span className={`font-bold ${aviso && n > 0 ? "text-naranja" : "text-tenue"}`}>{n}</span>}
      </a>
    </li>
  );
}

function NoInterpretado({ avisos }: { avisos: Aviso[] }) {
  return (
    <section id="rev-no-interpretado" aria-labelledby="rev-no-interpretado-titulo" className="rounded-2xl border border-naranja/40 bg-naranja/10 p-4">
      <h2 id="rev-no-interpretado-titulo" className="font-display text-xl font-bold uppercase italic">
        No interpretado
      </h2>
      {avisos.length === 0 ? (
        <p className="mt-2 text-sm">Se ha interpretado todo el texto del documento.</p>
      ) : (
        <>
          <p className="mt-2 text-sm">
            Esta parte del documento no se ha podido convertir. No se ha inventado nada: si es importante, añádela a mano
            (por ejemplo, las fases que estén dentro de una imagen).
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {avisos.map((a, i) => (
              <li key={i} className="rounded-xl bg-noche p-3 ring-1 ring-noche-500">
                <p className="font-bold">
                  {a.pagina ? `Página ${a.pagina}: ` : ""}
                  {a.motivo}
                </p>
                {a.texto && <p className="mt-1 whitespace-pre-line text-blanco/80">{a.texto}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Bloque({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-4 space-y-4">
      <h2 id={`${id}-titulo`} className="font-display text-xl font-bold uppercase italic tracking-wide">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Tarjeta({
  incluir,
  etiqueta,
  pagina,
  alIncluir,
  children,
}: {
  incluir: boolean;
  etiqueta: string;
  pagina: number | null;
  alIncluir: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <li className={`space-y-3 rounded-2xl bg-noche p-3 ring-1 ring-noche-500 ${incluir ? "" : "opacity-60"}`}>
      <div className="flex items-center justify-between gap-3">
        <Casilla etiqueta="Incluir" etiquetaAccesible={`Incluir ${etiqueta}`} marcada={incluir} alCambiar={alIncluir} />
        <span className="text-xs text-tenue">{pagina ? `pág. ${pagina}` : "añadida en la revisión"}</span>
      </div>
      {children}
    </li>
  );
}

function Casilla({
  etiqueta,
  etiquetaAccesible,
  marcada,
  desactivada = false,
  oculta = false,
  alCambiar,
}: {
  etiqueta: string;
  etiquetaAccesible?: string;
  marcada: boolean;
  desactivada?: boolean;
  /** Solo para lectores de pantalla (la fila ya muestra el nombre). */
  oculta?: boolean;
  alCambiar: (v: boolean) => void;
}) {
  // Como las notas de la evaluación: la casilla real ocupa toda la etiqueta
  // (zona táctil ≥ 44 px) y se dibuja una caja visible.
  return (
    <label className={`${claseCasilla} relative min-w-11 ${oculta ? "justify-center" : ""} ${desactivada ? "cursor-not-allowed opacity-50" : ""}`}>
      <input
        type="checkbox"
        checked={marcada}
        disabled={desactivada}
        aria-label={etiquetaAccesible}
        onChange={(e) => alCambiar(e.target.checked)}
        className="peer absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <span
        aria-hidden="true"
        className="grid size-6 shrink-0 place-items-center rounded-md ring-2 ring-noche-500 peer-checked:bg-electrico peer-checked:ring-electrico peer-focus-visible:ring-blanco [&>svg]:invisible peer-checked:[&>svg]:visible"
      >
        <svg viewBox="0 0 16 16" className="size-4 text-noche" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M3 8.5l3 3 7-7" />
        </svg>
      </span>
      <span className={oculta ? "sr-only" : ""}>{etiqueta}</span>
    </label>
  );
}

function Texto({
  etiqueta,
  valor,
  max,
  area = false,
  numero = false,
  oculta = false,
  alCambiar,
}: {
  etiqueta: string;
  valor: string;
  max: number;
  area?: boolean;
  numero?: boolean;
  oculta?: boolean;
  alCambiar: (v: string) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={oculta ? "sr-only" : "mb-1.5 block text-sm font-semibold"}>
        {etiqueta}
      </label>
      {area ? (
        <textarea id={id} value={valor} maxLength={max} rows={Math.min(8, Math.max(2, Math.ceil(valor.length / 70)))} onChange={(e) => alCambiar(e.target.value)} className={claseArea} />
      ) : (
        <input
          id={id}
          type={numero ? "number" : "text"}
          inputMode={numero ? "numeric" : undefined}
          min={numero ? 1 : undefined}
          max={numero ? 99 : undefined}
          value={valor}
          maxLength={numero ? undefined : max}
          autoComplete="off"
          onChange={(e) => alCambiar(e.target.value)}
          className={claseCampo}
        />
      )}
    </div>
  );
}

function SelectorCategoria({ valor, etiqueta, alCambiar }: { valor: CategoriaSeccion | null; etiqueta: string; alCambiar: (v: CategoriaSeccion | null) => void }) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="sr-only">
        {etiqueta}
      </label>
      <select id={id} value={valor ?? ""} onChange={(e) => alCambiar((e.target.value || null) as CategoriaSeccion | null)} className={claseCampo}>
        <option value="">Sin categoría</option>
        {(Object.keys(CATEGORIA_TEXTO) as CategoriaSeccion[]).map((c) => (
          <option key={c} value={c}>
            {CATEGORIA_TEXTO[c]}
          </option>
        ))}
      </select>
    </div>
  );
}

function agrupar<T>(elementos: T[], claveDe: (e: T) => string): [string, T[]][] {
  const mapa = new Map<string, T[]>();
  for (const e of elementos) {
    const k = claveDe(e);
    mapa.set(k, [...(mapa.get(k) ?? []), e]);
  }
  return [...mapa];
}

/** Apartados de las fichas por categoría (objetivos, identidad, ejercicios…). */
function resumenCategorias(p: Propuesta): [CategoriaSeccion, number][] {
  const cuenta = new Map<CategoriaSeccion, number>();
  for (const f of p.fichas) for (const s of f.secciones) if (s.categoria) cuenta.set(s.categoria, (cuenta.get(s.categoria) ?? 0) + 1);
  return (Object.keys(CATEGORIA_TEXTO) as CategoriaSeccion[]).filter((c) => cuenta.has(c)).map((c) => [c, cuenta.get(c)!]);
}
