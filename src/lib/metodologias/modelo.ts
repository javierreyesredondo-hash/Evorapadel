// Modelo de una metodología importada desde PDF: la PROPUESTA que se revisa
// antes de guardar y su validación estricta en el servidor (sin React ni
// Supabase; probada con node --test).
//
// Nada de lo que hay aquí se inventa: cada elemento procede del texto del PDF
// (con su página) o lo añade/corrige la dirección durante la revisión.

export type CategoriaSeccion = "objetivos" | "identidad" | "ejercicios" | "exito" | "sesion";

export const CATEGORIA_TEXTO: Record<CategoriaSeccion, string> = {
  objetivos: "Objetivos y prioridades",
  identidad: "Patrones e identidad de juego",
  ejercicios: "Ejercicios y progresiones",
  exito: "Criterios de éxito y transferencia",
  sesion: "Plantillas de sesión",
};

export type Fase = { numero: number | null; nombre: string; descripcion: string; pagina: number | null; incluir: boolean };
export type Principio = { nombre: string; descripcion: string; pagina: number | null; incluir: boolean };
export type TextoMetodologia = { titulo: string; texto: string; pagina: number | null; incluir: boolean };
export type NivelEscala = { valor: 1 | 2 | 3 | 4 | 5; nombre: string; descripcion: string };
export type CompetenciaPropuesta = {
  nombre: string;
  /** Categoría original del documento (p. ej. «Toma de decisiones»). */
  grupo: string;
  descripcion: string;
  /** El documento la puntúa de 1 a 5 (si no, es un indicador de observación). */
  puntuable: boolean;
  /** Se usará en las evaluaciones de ÉVORA al activar la metodología. */
  evaluable: boolean;
  origen: string;
  pagina: number | null;
  incluir: boolean;
};

export type TipoCampo = "texto" | "escala" | "opciones" | "lista" | "tabla" | "nota";
export type ColumnaTabla = { titulo: string; tipo: "escala" | "texto" };
export type Campo = {
  tipo: TipoCampo;
  etiqueta: string;
  /** opciones: casillas de selección. */
  opciones?: string[];
  /** lista: número de elementos (1: ___, 2: ___…). */
  elementos?: number;
  /** texto: líneas para escribir. */
  lineas?: number;
  /** tabla: columnas y filas (la primera columna son las filas). */
  columnas?: ColumnaTabla[];
  filas?: string[];
  incluir: boolean;
};
export type SeccionFicha = { titulo: string; categoria: CategoriaSeccion | null; campos: Campo[]; incluir: boolean };
export type Ficha = { numero: number | null; titulo: string; descripcion: string; secciones: SeccionFicha[]; pagina: number | null; incluir: boolean };
export type Aviso = { pagina: number | null; motivo: string; texto: string };

export type Documento = { nombre: string; bytes: number; paginas: number; sha256: string };

export type Propuesta = {
  nombre: string;
  version: string;
  descripcion: string;
  textos: TextoMetodologia[];
  fases: Fase[];
  principios: Principio[];
  escala: NivelEscala[];
  competencias: CompetenciaPropuesta[];
  fichas: Ficha[];
  /** Lo que no se ha podido interpretar (imágenes, tablas sin clasificar…). */
  noInterpretado: Aviso[];
};

// ----------------------------------------------------------------- límites

export const LIMITES_IMPORTACION = {
  pdfBytes: 4 * 1024 * 1024,
  pdfPaginas: 40,
  nombre: 120,
  version: 20,
  descripcion: 2000,
  titulo: 120,
  texto: 3000,
  fases: 30,
  principios: 40,
  textos: 40,
  competencias: 200,
  competenciaNombre: 80,
  competenciaDescripcion: 300,
  fichas: 30,
  secciones: 40,
  campos: 80,
  opciones: 20,
  filas: 40,
  columnas: 8,
  etiqueta: 200,
  contenidoBytes: 350_000,
} as const;

// ------------------------------------------------------------- validación

/** Contenido que se guarda (solo lo incluido, sin marcas de revisión). */
export type ContenidoMetodologia = {
  textos: Omit<TextoMetodologia, "incluir">[];
  fases: Omit<Fase, "incluir">[];
  principios: Omit<Principio, "incluir">[];
  escala: NivelEscala[];
  competencias: Omit<CompetenciaPropuesta, "incluir">[];
  fichas: (Omit<Ficha, "incluir" | "secciones"> & { secciones: (Omit<SeccionFicha, "incluir" | "campos"> & { campos: Omit<Campo, "incluir">[] })[] })[];
};

export type MetodologiaValidada = {
  nombre: string;
  version: string;
  descripcion: string | null;
  contenido: ContenidoMetodologia;
  documento: Documento | null;
};

type Resultado = { ok: true; valor: MetodologiaValidada } | { ok: false; errores: string[] };

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/** Texto limpio: sin caracteres de control, espacios normalizados (conserva saltos de línea). */
export function limpiar(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(CONTROL, "").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return t.length <= max ? t : null;
}

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const lista = (v: unknown, max: number): unknown[] | null => (Array.isArray(v) && v.length <= max ? v : null);
const pagina = (v: unknown): number | null => (Number.isInteger(v) && (v as number) > 0 && (v as number) <= 1000 ? (v as number) : null);
const incluido = (v: Record<string, unknown>) => v.incluir !== false;
const clave = (grupo: string, nombre: string) =>
  `${grupo}\u0000${nombre}`.toLocaleLowerCase("es").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

/**
 * Valida y normaliza la propuesta revisada que envía el navegador. Nunca se
 * confía en ella: forma, tipos, longitudes y número de elementos.
 */
export function validarPropuesta(entrada: unknown, documento: unknown): Resultado {
  const errores: string[] = [];
  const err = (m: string) => {
    if (errores.length < 20) errores.push(m);
  };
  if (!esObjeto(entrada)) return { ok: false, errores: ["La propuesta no tiene el formato esperado."] };
  const L = LIMITES_IMPORTACION;

  const nombre = limpiar(entrada.nombre, L.nombre);
  if (!nombre || nombre.length < 2) err(`El nombre de la metodología debe tener entre 2 y ${L.nombre} caracteres.`);
  const version = limpiar(entrada.version, L.version);
  if (!version) err(`Indica la versión (máximo ${L.version} caracteres), por ejemplo «1.0».`);
  const descripcion = limpiar(entrada.descripcion ?? "", L.descripcion);
  if (descripcion === null) err(`La descripción admite como máximo ${L.descripcion} caracteres.`);

  // Textos (filosofía, introducciones).
  const textos: ContenidoMetodologia["textos"] = [];
  const textosEntrada = lista(entrada.textos ?? [], L.textos);
  if (!textosEntrada) err(`Como máximo ${L.textos} textos.`);
  for (const t of textosEntrada ?? []) {
    if (!esObjeto(t) || !incluido(t)) continue;
    const titulo = limpiar(t.titulo, L.titulo);
    const texto = limpiar(t.texto, L.texto);
    if (!titulo || texto === null) err(`Un texto («${String(t.titulo ?? "").slice(0, 40)}») no es válido o es demasiado largo.`);
    else if (texto) textos.push({ titulo, texto, pagina: pagina(t.pagina) });
  }

  // Fases.
  const fases: ContenidoMetodologia["fases"] = [];
  const fasesEntrada = lista(entrada.fases ?? [], L.fases);
  if (!fasesEntrada) err(`Como máximo ${L.fases} fases.`);
  for (const f of fasesEntrada ?? []) {
    if (!esObjeto(f) || !incluido(f)) continue;
    const nombreFase = limpiar(f.nombre, L.titulo);
    const desc = limpiar(f.descripcion ?? "", L.texto);
    const numero = Number.isInteger(f.numero) && (f.numero as number) >= 0 && (f.numero as number) < 1000 ? (f.numero as number) : null;
    if (!nombreFase || desc === null) err("Hay una fase sin nombre o con un texto demasiado largo.");
    else fases.push({ numero, nombre: nombreFase, descripcion: desc, pagina: pagina(f.pagina) });
  }
  fases.sort((a, b) => (a.numero ?? 999) - (b.numero ?? 999));

  // Principios y reglas.
  const principios: ContenidoMetodologia["principios"] = [];
  const principiosEntrada = lista(entrada.principios ?? [], L.principios);
  if (!principiosEntrada) err(`Como máximo ${L.principios} principios.`);
  for (const p of principiosEntrada ?? []) {
    if (!esObjeto(p) || !incluido(p)) continue;
    const n = limpiar(p.nombre, L.titulo);
    const d = limpiar(p.descripcion ?? "", L.texto);
    if (!n || d === null) err("Hay un principio sin nombre o con un texto demasiado largo.");
    else principios.push({ nombre: n, descripcion: d, pagina: pagina(p.pagina) });
  }

  // Escala: vacía (se usa la de ÉVORA) o exactamente los niveles 1–5.
  const escala: NivelEscala[] = [];
  const escalaEntrada = lista(entrada.escala ?? [], 5);
  if (!escalaEntrada) err("La escala admite como máximo 5 niveles (1 a 5).");
  for (const n of escalaEntrada ?? []) {
    if (!esObjeto(n)) continue;
    const valor = n.valor;
    const nombreNivel = limpiar(n.nombre, 60);
    const desc = limpiar(n.descripcion ?? "", 500);
    if (![1, 2, 3, 4, 5].includes(valor as number) || !nombreNivel || desc === null) err("Cada nivel de la escala necesita un valor de 1 a 5 y un nombre.");
    else escala.push({ valor: valor as NivelEscala["valor"], nombre: nombreNivel, descripcion: desc });
  }
  escala.sort((a, b) => a.valor - b.valor);
  if (escala.length > 0 && (escala.length !== 5 || escala.some((n, i) => n.valor !== i + 1)))
    err("La escala debe tener los cinco niveles, del 1 al 5 (ÉVORA puntúa de 1 a 5).");

  // Competencias e indicadores.
  const competencias: ContenidoMetodologia["competencias"] = [];
  const vistas = new Set<string>();
  const compEntrada = lista(entrada.competencias ?? [], L.competencias);
  if (!compEntrada) err(`Como máximo ${L.competencias} competencias e indicadores.`);
  for (const c of compEntrada ?? []) {
    if (!esObjeto(c) || !incluido(c)) continue;
    const n = limpiar(c.nombre, L.competenciaNombre);
    const grupo = limpiar(c.grupo ?? "", L.competenciaNombre);
    const desc = limpiar(c.descripcion ?? "", L.competenciaDescripcion);
    if (!n || n.length < 2 || grupo === null || desc === null) {
      err(`Revisa la competencia «${String(c.nombre ?? "").slice(0, 40)}»: nombre de 2 a ${L.competenciaNombre} caracteres y descripción de hasta ${L.competenciaDescripcion}.`);
      continue;
    }
    const puntuable = c.puntuable === true;
    const evaluable = c.evaluable === true;
    if (evaluable && !puntuable) err(`«${n}» no tiene escala 1–5 en el documento: no puede ser evaluable.`);
    if (evaluable && !grupo) err(`«${n}» necesita un grupo (categoría) para poder evaluarse.`);
    const k = clave(grupo, n);
    if (vistas.has(k)) err(`«${n}» aparece dos veces en «${grupo || "sin grupo"}»: descarta o renombra una.`);
    vistas.add(k);
    competencias.push({ nombre: n, grupo, descripcion: desc, puntuable, evaluable, origen: limpiar(c.origen ?? "", 120) ?? "", pagina: pagina(c.pagina) });
  }

  // Fichas.
  const fichas: ContenidoMetodologia["fichas"] = [];
  const fichasEntrada = lista(entrada.fichas ?? [], L.fichas);
  if (!fichasEntrada) err(`Como máximo ${L.fichas} fichas.`);
  for (const f of fichasEntrada ?? []) {
    if (!esObjeto(f) || !incluido(f)) continue;
    const titulo = limpiar(f.titulo, L.titulo);
    const desc = limpiar(f.descripcion ?? "", L.texto);
    const seccionesEntrada = lista(f.secciones ?? [], L.secciones);
    if (!titulo || desc === null || !seccionesEntrada) {
      err(`Revisa la ficha «${String(f.titulo ?? "").slice(0, 40)}».`);
      continue;
    }
    const secciones: ContenidoMetodologia["fichas"][number]["secciones"] = [];
    for (const s of seccionesEntrada) {
      if (!esObjeto(s) || !incluido(s)) continue;
      const tituloSeccion = limpiar(s.titulo, L.titulo);
      const camposEntrada = lista(s.campos ?? [], L.campos);
      if (!tituloSeccion || !camposEntrada) {
        err(`Revisa un apartado de la ficha «${titulo}».`);
        continue;
      }
      const categoria = Object.hasOwn(CATEGORIA_TEXTO, String(s.categoria)) ? (s.categoria as CategoriaSeccion) : null;
      const campos: Omit<Campo, "incluir">[] = [];
      for (const c of camposEntrada) {
        if (!esObjeto(c) || !incluido(c)) continue;
        const campo = validarCampo(c);
        if (!campo) err(`Revisa un campo del apartado «${tituloSeccion}» (ficha «${titulo}»).`);
        else campos.push(campo);
      }
      secciones.push({ titulo: tituloSeccion, categoria, campos });
    }
    const numero = Number.isInteger(f.numero) && (f.numero as number) >= 0 && (f.numero as number) < 1000 ? (f.numero as number) : null;
    fichas.push({ numero, titulo, descripcion: desc, secciones, pagina: pagina(f.pagina) });
  }

  const contenido: ContenidoMetodologia = { textos, fases, principios, escala, competencias, fichas };
  if (new TextEncoder().encode(JSON.stringify(contenido)).length > L.contenidoBytes)
    err("La metodología es demasiado grande: descarta elementos que no necesites.");

  const doc = validarDocumento(documento);
  if (documento != null && !doc) err("La referencia al PDF no es válida. Vuelve a analizar el documento.");

  if (errores.length > 0) return { ok: false, errores };
  return {
    ok: true,
    valor: { nombre: nombre!, version: version!, descripcion: descripcion || null, contenido, documento: doc },
  };
}

function validarCampo(c: Record<string, unknown>): Omit<Campo, "incluir"> | null {
  const L = LIMITES_IMPORTACION;
  const tipo = c.tipo;
  const etiqueta = limpiar(c.etiqueta, L.etiqueta);
  if (!etiqueta) return null;
  switch (tipo) {
    case "texto": {
      const lineas = Number.isInteger(c.lineas) && (c.lineas as number) >= 1 && (c.lineas as number) <= 10 ? (c.lineas as number) : 1;
      return { tipo, etiqueta, lineas };
    }
    case "escala":
    case "nota":
      return { tipo, etiqueta };
    case "lista": {
      const elementos = c.elementos;
      return Number.isInteger(elementos) && (elementos as number) >= 1 && (elementos as number) <= 20 ? { tipo, etiqueta, elementos: elementos as number } : null;
    }
    case "opciones": {
      const opciones = lista(c.opciones, L.opciones)?.map((o) => limpiar(o, 80));
      return opciones && opciones.length >= 1 && opciones.every((o) => o) ? { tipo, etiqueta, opciones: opciones as string[] } : null;
    }
    case "tabla": {
      const columnas = lista(c.columnas, L.columnas);
      const filas = lista(c.filas, L.filas)?.map((f) => limpiar(f, 80));
      if (!columnas || !filas || filas.length === 0 || !filas.every((f) => f)) return null;
      const cols: ColumnaTabla[] = [];
      for (const col of columnas) {
        if (!esObjeto(col)) return null;
        const t = limpiar(col.titulo, 60);
        if (!t || (col.tipo !== "escala" && col.tipo !== "texto")) return null;
        cols.push({ titulo: t, tipo: col.tipo });
      }
      return { tipo, etiqueta, columnas: cols, filas: filas as string[] };
    }
    default:
      return null;
  }
}

export function validarDocumento(v: unknown): Documento | null {
  if (!esObjeto(v)) return null;
  const nombre = limpiar(v.nombre, 200);
  const { bytes, paginas, sha256 } = v;
  if (!nombre || !Number.isInteger(bytes) || (bytes as number) <= 0 || (bytes as number) > LIMITES_IMPORTACION.pdfBytes) return null;
  if (!Number.isInteger(paginas) || (paginas as number) <= 0 || (paginas as number) > LIMITES_IMPORTACION.pdfPaginas) return null;
  if (typeof sha256 !== "string" || !/^[0-9a-f]{64}$/.test(sha256)) return null;
  return { nombre, bytes: bytes as number, paginas: paginas as number, sha256 };
}

/** Competencias que se evaluarán al activar la metodología. */
export const competenciasEvaluables = (c: Pick<ContenidoMetodologia, "competencias">) => c.competencias.filter((x) => x.evaluable);
