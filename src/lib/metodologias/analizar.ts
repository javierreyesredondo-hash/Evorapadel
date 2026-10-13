// Análisis de un documento de metodología: de las líneas del PDF a una
// PROPUESTA revisable (modelo.ts). Reglas deterministas y generales, sin IA ni
// servicios externos; lo que no encaja se lista en «noInterpretado». Nunca se
// inventa contenido: solo se reorganiza el texto que hay en el PDF.
//
// Reglas principales:
//   * Títulos por tamaño de letra relativo al cuerpo del texto.
//   * «FICHA 01 · NOMBRE» abre una ficha; sus apartados son los títulos.
//   * Campos: «Etiqueta: _____» (texto), «Etiqueta: 1 2 3 4 5» (escala),
//     «☐ A ☐ B» (opciones), «1: _____» (lista), tablas por columnas alineadas.
//   * Escala: «1 • INICIAL» seguido de su descripción.
//   * Fases: un número suelto («01») seguido de un título y su descripción.
//   * Tablas: «Principio | Qué significa» → principios; «Competencia | Qué
//     observamos» → competencias; con una columna «1–5» → tabla de ficha.

import { type Linea, textoLinea } from "./lineas.ts";
import type {
  Aviso,
  Campo,
  CategoriaSeccion,
  CompetenciaPropuesta,
  Fase,
  Ficha,
  NivelEscala,
  Principio,
  Propuesta,
  SeccionFicha,
  TextoMetodologia,
} from "./modelo.ts";

export type PaginaExtraida = {
  numero: number;
  lineas: Linea[];
  /** Fracción de la superficie de la página ocupada por imágenes (0–1). */
  fraccionImagen: number;
};

type Nivel = "h1" | "h2" | "h3" | "cuerpo" | "pequeno";
type LineaP = Linea & { pagina: number; texto: string; nivel: Nivel };

// ------------------------------------------------------------ utilidades de texto

const LETRAS = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g;
function esMayusculas(t: string): boolean {
  const letras = (t.match(LETRAS) ?? []).join("");
  return letras.length >= 2 && letras === letras.toLocaleUpperCase("es");
}

/** «TOMA DE DECISIONES» → «Toma de decisiones». Si no está en mayúsculas, no se toca. */
export function enFrase(t: string): string {
  const limpio = t.replace(/\s+/g, " ").trim();
  if (!esMayusculas(limpio)) return limpio;
  const m = limpio.toLocaleLowerCase("es");
  return m.charAt(0).toLocaleUpperCase("es") + m.slice(1);
}

const MENORES = new Set(["de", "del", "la", "las", "el", "los", "y", "e", "o", "u", "a", "al", "en", "con", "por", "para", "su", "sus"]);
/** «MÉTODO JAVIER REYES» → «Método Javier Reyes» (nombres propios). */
export function enTitulo(t: string): string {
  const limpio = t.replace(/\s+/g, " ").trim();
  if (!esMayusculas(limpio)) return limpio;
  return limpio
    .toLocaleLowerCase("es")
    .split(" ")
    .map((p, i) => (i > 0 && MENORES.has(p) ? p : p.charAt(0).toLocaleUpperCase("es") + p.slice(1)))
    .join(" ");
}

/** «A. TÉCNICA» → «Técnica». */
const tituloApartado = (t: string) => enFrase(t.replace(/^[A-Z]\.\s+/, ""));

const sinAcentos = (t: string) => t.toLocaleLowerCase("es").normalize("NFD").replace(/[̀-ͯ]/g, "");

const RE = {
  ficha: /^FICHA\s*(\d+)\s*[·•:.\-–—]\s*(.+)$/i,
  digito: /^\d{1,2}$/,
  nivelEscala: /^([1-5])\s*[•·\-–—:.)]\s*([^_\d][^_]{0,40})$/,
  escalaCampo: /([^:]+?):\s*1\s*2\s*3\s*4\s*5/g,
  unoCinco: /^1\s*[–\-—]\s*5$/,
  listaItem: /^(\d+)\s*[:.)]\s*_{3,}\s*$/,
  soloRayas: /^["“”«»\s]*_{3,}["“”«»\s]*$/,
  campoTexto: /^(.*?\S)\s*_{3,}["”»]?\s*$/,
  opcion: /[☐□]/,
  version: /\bv\s?(\d+(?:\.\d+){0,2})\b/i,
  cita: /^["“«]/,
};

/** Sin «g»: para comprobar si un texto contiene un campo de escala. */
const ES_ESCALA = /:\s*1\s*2\s*3\s*4\s*5/;

function categoriaDe(titulo: string, ficha: string): CategoriaSeccion | null {
  const t = sinAcentos(titulo);
  if (/sesion/.test(sinAcentos(ficha))) return "sesion";
  if (/criterio de exito|transferencia|resultado/.test(t)) return "exito";
  if (/^ejercicio|^progresion|^intencion$/.test(t)) return "ejercicios";
  if (/identidad|patron|forma de ganar|principio de juego|estilo|momentos de ataque/.test(t)) return "identidad";
  if (/objetivo|prioridad|^bloque/.test(t)) return "objetivos";
  return null;
}

// ----------------------------------------------------------------- análisis

export function analizarDocumento(paginas: readonly PaginaExtraida[]): Propuesta {
  const cuerpo = tamanoCuerpo(paginas);
  const nivel = (l: Linea): Nivel =>
    l.tam >= 2.2 * cuerpo ? "h1" : l.tam >= 1.75 * cuerpo ? "h2" : l.tam >= 1.15 * cuerpo ? "h3" : l.tam < 0.9 * cuerpo ? "pequeno" : "cuerpo";

  const todas: LineaP[] = paginas.flatMap((p) => p.lineas.map((l) => ({ ...l, pagina: p.numero, texto: textoLinea(l), nivel: nivel(l) })));

  const propuesta: Propuesta = {
    nombre: "",
    version: "",
    descripcion: "",
    textos: [],
    fases: [],
    principios: [],
    escala: [],
    competencias: [],
    fichas: [],
    noInterpretado: [],
  };
  const avisar = (pagina: number | null, motivo: string, texto = "") => propuesta.noInterpretado.push({ pagina, motivo, texto });

  // ---- Portada (página 1 corta y sin fichas): nombre, versión y descripción.
  let inicio = 0;
  const portada = todas.filter((l) => l.pagina === 1);
  if (paginas.length > 1 && portada.length > 0 && portada.length <= 30 && !portada.some((l) => RE.ficha.test(l.texto))) {
    inicio = portada.length;
    const descripcion: string[] = [];
    const otros: string[] = [];
    for (const l of portada) {
      const version = l.texto.match(RE.version);
      if (version && !propuesta.version) {
        propuesta.version = version[1];
        const resto = l.texto.replace(RE.version, "").replace(/^[\s·•|\-–—]+|[\s·•|\-–—]+$/g, "");
        if (resto) otros.push(enFrase(resto));
        continue;
      }
      if ((l.nivel === "h1" || l.nivel === "h2") && !propuesta.nombre) propuesta.nombre = enTitulo(l.texto);
      else if (RE.cita.test(l.texto)) propuesta.textos.push({ titulo: "Cita", texto: l.texto, pagina: 1, incluir: true });
      else if (l.nivel === "pequeno") otros.push(l.texto);
      else descripcion.push(l.texto);
    }
    propuesta.descripcion = descripcion.join("\n");
    if (otros.length > 0) propuesta.textos.push({ titulo: "Portada", texto: otros.join("\n"), pagina: 1, incluir: true });
  }

  // ---- Recorrido del resto del documento.
  let seccion: { titulo: string; pagina: number } | null = null;
  let subseccion: string | null = null;
  const textos = new Map<string, TextoMetodologia>();
  const anadirTexto = (titulo: string, pagina: number, texto: string) => {
    const t = textos.get(titulo);
    if (t) t.texto += `\n${texto}`;
    else textos.set(titulo, { titulo, texto, pagina, incluir: true });
  };

  let ficha: Ficha | null = null;
  let apartado: SeccionFicha | null = null;
  let etiquetaPendiente: string | null = null;
  let ultimoTipo: Campo["tipo"] | null = null;

  const cerrarFicha = () => {
    if (ficha) {
      // Un título que solo agrupa otros apartados (sin campos propios) no aporta nada.
      ficha.secciones = ficha.secciones.filter((s) => s.campos.length > 0);
      propuesta.fichas.push(ficha);
    }
    ficha = null;
    apartado = null;
    etiquetaPendiente = null;
    ultimoTipo = null;
  };
  const asegurarApartado = (): SeccionFicha => {
    if (!apartado) {
      apartado = { titulo: "General", categoria: categoriaDe("", ficha!.titulo), campos: [], incluir: true };
      ficha!.secciones.push(apartado);
    }
    return apartado;
  };
  const anadirCampo = (c: Omit<Campo, "incluir">) => {
    asegurarApartado().campos.push({ ...c, incluir: true });
    ultimoTipo = c.tipo;
  };

  const esCuerpoSiguiente = (l: LineaP | undefined) =>
    !!l && l.nivel === "cuerpo" && !RE.digito.test(l.texto) && !RE.nivelEscala.test(l.texto) && !RE.ficha.test(l.texto) && !esEncabezadoCorto(l);
  /** Líneas de cuerpo que siguen a i (descripción de una fase, un nivel o una regla). */
  const recoger = (i: number): [string, number] => {
    const partes: string[] = [];
    let j = i + 1;
    while (esCuerpoSiguiente(todas[j]) && todas[j].segmentos.length === 1) partes.push(todas[j++].texto);
    return [partes.join(" "), j - 1];
  };

  for (let i = inicio; i < todas.length; i++) {
    const l = todas[i];
    const t = l.texto;

    if (l.nivel === "pequeno" && /^\d{1,3}$/.test(t)) continue; // numeración de página/sección

    const fichaRe = t.match(RE.ficha);
    if (fichaRe && (l.nivel === "h1" || l.nivel === "h2")) {
      cerrarFicha();
      ficha = { numero: Number(fichaRe[1]), titulo: enFrase(fichaRe[2]), descripcion: "", secciones: [], pagina: l.pagina, incluir: true };
      continue;
    }
    if (l.nivel === "h1") {
      cerrarFicha();
      seccion = { titulo: enFrase(t), pagina: l.pagina };
      subseccion = null;
      continue;
    }

    // Tablas (dentro o fuera de una ficha).
    const tabla = leerTabla(todas, i);
    if (tabla) {
      i = tabla.fin;
      const cab = tabla.cabecera.map(sinAcentos);
      const col = (re: RegExp) => cab.findIndex((c) => re.test(c));
      const unoCinco = tabla.cabecera.findIndex((c) => RE.unoCinco.test(c));
      if (ficha) {
        const a = asegurarApartado();
        anadirCampo({
          tipo: "tabla",
          etiqueta: a.titulo,
          columnas: tabla.cabecera.slice(1).map((c) => ({ titulo: enFrase(c), tipo: RE.unoCinco.test(c) ? "escala" : "texto" })),
          filas: tabla.filas.map((f) => f[0]).filter(Boolean),
        });
        continue;
      }
      const cPrincipio = col(/principio/);
      const cCompetencia = col(/competencia|criterio|elemento|indicador/);
      const cDescripcion = col(/signific|descrip|observ|que /);
      if (cPrincipio >= 0) {
        for (const f of tabla.filas)
          if (f[cPrincipio])
            propuesta.principios.push({ nombre: f[cPrincipio], descripcion: cDescripcion >= 0 ? f[cDescripcion] : "", pagina: l.pagina, incluir: true });
      } else if (cCompetencia >= 0) {
        const grupo = subseccion ?? seccion?.titulo ?? "Competencias";
        for (const f of tabla.filas)
          if (f[cCompetencia])
            propuesta.competencias.push({
              nombre: f[cCompetencia],
              grupo,
              descripcion: cDescripcion >= 0 ? f[cDescripcion] : "",
              puntuable: unoCinco >= 0 || seccionConEscala(todas),
              evaluable: unoCinco >= 0 || seccionConEscala(todas),
              origen: `${grupo} (tabla)`,
              pagina: l.pagina,
              incluir: true,
            });
      } else {
        avisar(l.pagina, "Tabla sin clasificar: revísala y añade a mano lo que necesites.", [tabla.cabecera, ...tabla.filas].map((f) => f.join(" | ")).join("\n"));
      }
      continue;
    }

    if (ficha) {
      procesarLineaFicha(l);
      continue;
    }

    // ---- Fuera de las fichas.
    if (l.nivel === "h2") {
      subseccion = enFrase(t);
      continue;
    }
    const nivelEscala = t.match(RE.nivelEscala);
    if (nivelEscala && (l.nivel === "h3" || l.negrita || esMayusculas(nivelEscala[2]))) {
      const [descripcion, fin] = recoger(i);
      const valor = Number(nivelEscala[1]) as NivelEscala["valor"];
      if (!propuesta.escala.some((n) => n.valor === valor)) propuesta.escala.push({ valor, nombre: enFrase(nivelEscala[2]), descripcion });
      i = fin;
      continue;
    }
    if (RE.digito.test(t)) {
      const siguiente = todas[i + 1];
      if (siguiente && !RE.nivelEscala.test(siguiente.texto) && (siguiente.nivel === "h3" || esEncabezadoCorto(siguiente))) {
        const [descripcion, fin] = recoger(i + 1);
        propuesta.fases.push({ numero: Number(t), nombre: enFrase(siguiente.texto), descripcion, pagina: l.pagina, incluir: true });
        i = fin;
      }
      continue; // número decorativo (p. ej. junto a la escala)
    }
    if (l.nivel === "h3" || esEncabezadoCorto(l)) {
      const [descripcion, fin] = recoger(i);
      if (descripcion) {
        propuesta.principios.push({ nombre: enFrase(t), descripcion, pagina: l.pagina, incluir: true });
        i = fin;
      } else {
        avisar(l.pagina, "Título sin contenido reconocible.", t);
      }
      continue;
    }
    if (l.nivel === "cuerpo" || l.nivel === "pequeno") {
      anadirTexto(subseccion ?? seccion?.titulo ?? "Introducción", l.pagina, t);
      continue;
    }
    avisar(l.pagina, "Texto sin interpretar.", t);
  }
  cerrarFicha();

  // Textos: el de cada sección (filosofía, introducciones…).
  propuesta.textos.push(...textos.values());

  // ---- Competencias e indicadores de la ficha de evaluación.
  for (const f of propuesta.fichas) {
    if (!/evaluaci/.test(sinAcentos(f.titulo))) continue;
    for (const s of f.secciones) {
      const origen = `Ficha ${f.numero ?? ""} · ${s.titulo}`.replace(/\s+/g, " ");
      const soloTexto = s.campos.length >= 2 && s.campos.every((c) => c.tipo === "texto");
      for (const c of s.campos) {
        const base = { grupo: s.titulo, descripcion: "", evaluable: false, origen, pagina: f.pagina, incluir: true };
        if (c.tipo === "tabla" && c.columnas?.some((x) => x.tipo === "escala"))
          for (const fila of c.filas ?? []) propuesta.competencias.push({ ...base, nombre: fila, puntuable: true });
        else if (c.tipo === "escala") propuesta.competencias.push({ ...base, nombre: c.etiqueta, puntuable: true });
        else if (soloTexto) propuesta.competencias.push({ ...base, nombre: c.etiqueta, puntuable: false });
      }
    }
  }

  // ---- Avisos.
  for (const p of paginas) {
    if (p.fraccionImagen >= 0.2) {
      const titulos = todas.filter((l) => l.pagina === p.numero && (l.nivel === "h1" || l.nivel === "h2")).map((l) => l.texto);
      avisar(
        p.numero,
        `La página contiene imágenes (aprox. ${Math.round(p.fraccionImagen * 100)} % de su superficie). Si muestran texto —un diagrama, un esquema o una tabla—, no se ha podido leer sin OCR: revisa el PDF y añade a mano lo que falte (por ejemplo, fases).`,
        titulos.join(" · "),
      );
    } else if (p.lineas.length === 0) {
      avisar(p.numero, "Página sin texto extraíble.");
    }
  }
  if (!propuesta.version) avisar(null, "No se ha encontrado la versión del documento: indícala antes de guardar.");
  if (!propuesta.nombre) {
    const primero = todas.find((l) => l.nivel === "h1");
    propuesta.nombre = primero ? enTitulo(primero.texto) : "";
    if (!propuesta.nombre) avisar(null, "No se ha encontrado el nombre de la metodología: indícalo antes de guardar.");
  }
  if (propuesta.escala.length > 0 && propuesta.escala.length < 5)
    avisar(null, `Se han encontrado ${propuesta.escala.length} niveles de escala: ÉVORA necesita los cinco (1 a 5). Complétalos o descártalos.`);
  propuesta.escala.sort((a, b) => a.valor - b.valor);
  propuesta.fases.sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0));
  return propuesta;

  // ------------------------------------------------------- líneas de una ficha
  function procesarLineaFicha(l: LineaP) {
    const f = ficha!;
    const esCampo = RE.campoTexto.test(l.texto) || RE.opcion.test(l.texto) || ES_ESCALA.test(l.texto);
    if ((l.nivel === "h2" || l.nivel === "h3" || esEncabezadoCorto(l)) && !esCampo) {
      apartado = { titulo: tituloApartado(l.texto), categoria: categoriaDe(l.texto, f.titulo), campos: [], incluir: true };
      f.secciones.push(apartado);
      etiquetaPendiente = null;
      ultimoTipo = null;
      return;
    }
    for (const s of l.segmentos) procesarTexto(s.texto.trim(), l);
  }

  function procesarTexto(txt: string, l: LineaP) {
    const f = ficha!;
    const escalas = [...txt.matchAll(RE.escalaCampo)];
    if (escalas.length > 0) {
      for (const m of escalas) anadirCampo({ tipo: "escala", etiqueta: enFrase(m[1].trim()) });
      return;
    }
    if (RE.opcion.test(txt)) {
      const [prefijo, ...resto] = txt.split(/[☐□]/);
      const opciones = resto.map((o) => o.trim()).filter(Boolean);
      const a = asegurarApartado();
      const ultimo = a.campos[a.campos.length - 1];
      const repetida = ultimo?.opciones?.some((o) => opciones.some((n) => sinAcentos(n) === sinAcentos(o)));
      if (ultimo?.tipo === "opciones" && ultimoTipo === "opciones" && !prefijo.trim() && !repetida) {
        ultimo.opciones!.push(...opciones);
      } else if (opciones.length > 0) {
        let etiqueta = prefijo.trim().replace(/:$/, "") || a.titulo;
        const iguales = a.campos.filter((c) => c.tipo === "opciones" && c.etiqueta.startsWith(etiqueta)).length;
        if (iguales > 0) etiqueta = `${etiqueta} (${iguales + 1})`;
        anadirCampo({ tipo: "opciones", etiqueta: enFrase(etiqueta), opciones });
      }
      return;
    }
    if (RE.listaItem.test(txt)) {
      const a = asegurarApartado();
      const ultimo = a.campos[a.campos.length - 1];
      if (ultimo?.tipo === "lista" && ultimoTipo === "lista") ultimo.elementos = (ultimo.elementos ?? 0) + 1;
      else anadirCampo({ tipo: "lista", etiqueta: a.titulo, elementos: 1 });
      return;
    }
    if (RE.soloRayas.test(txt)) {
      const a = asegurarApartado();
      const ultimo = a.campos[a.campos.length - 1];
      if (etiquetaPendiente) {
        anadirCampo({ tipo: "texto", etiqueta: etiquetaPendiente, lineas: 1 });
        etiquetaPendiente = null;
      } else if (ultimo?.tipo === "texto" && ultimoTipo === "texto") ultimo.lineas = Math.min(10, (ultimo.lineas ?? 1) + 1);
      else anadirCampo({ tipo: "texto", etiqueta: a.titulo, lineas: 1 });
      return;
    }
    const campo = txt.match(RE.campoTexto);
    if (campo) {
      anadirCampo({ tipo: "texto", etiqueta: campo[1].replace(/\s*:\s*$/, "").trim(), lineas: 1 });
      etiquetaPendiente = null;
      return;
    }
    if (/:\s*$/.test(txt)) {
      etiquetaPendiente = txt.replace(/\s*:\s*$/, "");
      return;
    }
    if (!apartado && f.secciones.length === 0 && !f.descripcion) {
      f.descripcion = txt;
      return;
    }
    if (/[.!?»"”]$/.test(txt) || /^nota\b/i.test(txt)) {
      anadirCampo({ tipo: "nota", etiqueta: txt });
      return;
    }
    avisar(l.pagina, `Texto de la ficha «${f.titulo}» sin formato reconocible.`, txt);
  }
}

// ------------------------------------------------------------ piezas sueltas

/** Línea corta en negrita o en mayúsculas que actúa como título («Regla de oro», «DATOS DEL JUGADOR»). */
function esEncabezadoCorto(l: LineaP): boolean {
  if (l.segmentos.length !== 1) return false;
  const t = l.texto;
  if (t.length > 60 || /[.:;,]$/.test(t) || RE.opcion.test(t) || /_{3,}/.test(t) || RE.digito.test(t)) return false;
  const palabras = t.split(" ").length;
  return palabras <= 7 && (l.negrita || (esMayusculas(t) && l.nivel !== "pequeno"));
}

/** ¿El documento define una escala de niveles «1 • …»? (las competencias de sus tablas se puntúan con ella) */
function seccionConEscala(todas: readonly LineaP[]): boolean {
  return todas.some((l) => RE.nivelEscala.test(l.texto) && (l.nivel === "h3" || l.negrita || esMayusculas(l.texto)));
}

/** Tamaño de letra del cuerpo: el más frecuente (ponderado por longitud del texto). */
function tamanoCuerpo(paginas: readonly PaginaExtraida[]): number {
  const cuenta = new Map<number, number>();
  for (const p of paginas)
    for (const l of p.lineas) {
      const t = Math.round(l.tam * 2) / 2;
      cuenta.set(t, (cuenta.get(t) ?? 0) + textoLinea(l).length);
    }
  let mejor = 12;
  let max = -1;
  for (const [t, n] of cuenta) if (n > max) [mejor, max] = [t, n];
  return mejor;
}

type Tabla = { cabecera: string[]; filas: string[][]; fin: number };

/** Cabecera de varias columnas seguida de filas alineadas con ella. */
function leerTabla(todas: readonly LineaP[], i: number): Tabla | null {
  const cab = todas[i];
  if (cab.segmentos.length < 2 || cab.nivel === "h1") return null;
  if (cab.segmentos.some((s) => s.texto.length > 40 || /_{3,}/.test(s.texto) || RE.opcion.test(s.texto))) return null;
  const xs = cab.segmentos.map((s) => s.x);
  const columna = (x: number) => {
    let mejor = -1;
    for (let c = 0; c < xs.length; c++) if (Math.abs(xs[c] - x) <= 20 && (mejor < 0 || Math.abs(xs[c] - x) < Math.abs(xs[mejor] - x))) mejor = c;
    return mejor;
  };
  const alineada = (l: LineaP | undefined) =>
    !!l && l.pagina === cab.pagina && l.nivel !== "h1" && l.nivel !== "h2" && l.segmentos.length >= 2 && l.segmentos.every((s) => columna(s.x) >= 0);
  if (!alineada(todas[i + 1])) return null;
  const filas: string[][] = [];
  let j = i + 1;
  while (alineada(todas[j])) {
    const fila = xs.map(() => "");
    for (const s of todas[j].segmentos) {
      const c = columna(s.x);
      fila[c] = fila[c] ? `${fila[c]} ${s.texto}` : s.texto;
    }
    filas.push(fila.map((v) => (/^[—–-]$/.test(v) || /^_{3,}$/.test(v) ? "" : v)));
    j++;
  }
  return { cabecera: cab.segmentos.map((s) => s.texto), filas, fin: j - 1 };
}

export type { Aviso, CompetenciaPropuesta, Fase, Principio };
