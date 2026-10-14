// Propuesta AUTOMÁTICA de redacción de una evaluación: fortalezas, aspectos a
// mejorar e interpretación técnica, a partir de las puntuaciones, la escala de
// la metodología activa (nombres y descripciones de los niveles) y las
// competencias (nombres y descripciones reales).
//
// Generador determinista y local (sin IA ni servicios externos): la misma
// entrada da siempre el mismo texto. Sin React, Next ni Supabase (node --test).
//
// Reglas:
//   * Fortalezas y aspectos a mejorar son RELATIVOS al propio perfil (las notas
//     más altas y más bajas del jugador), sin umbrales fijos; el texto se ajusta
//     al nivel absoluto (un 2 nunca se presenta como «fortaleza» a secas).
//   * Solo describe niveles y criterios de la metodología: nunca atribuye
//     causas («se precipita», «se bloquea»…). Las observaciones del entrenador
//     no se reescriben: se citan como contexto y se guardan aparte.
//   * Con pocas puntuaciones, la propuesta es provisional y no señala fortalezas.
//   * El objetivo de trabajo es siempre del entrenador: aquí solo se relaciona.

import type { Nota } from "./evaluaciones.ts";

export const VERSION_GENERADOR = "redaccion-1";

/** Mínimo de competencias puntuadas para señalar fortalezas y aspectos a mejorar. */
export const MINIMO_NOTAS = 3;

export type NivelDescrito = { nombre: string; descripcion: string | null };
export type EscalaDescrita = Record<Nota, NivelDescrito>;

export type NotaRedaccion = {
  nombre: string;
  grupo: string | null;
  descripcion: string | null;
  orden: number;
  puntuacion: Nota;
};

export type EntradaRedaccion = {
  /** Competencias puntuadas (con nota). */
  notas: readonly NotaRedaccion[];
  /** Competencias activas de la metodología (para saber si la valoración es parcial). */
  totalCompetencias: number;
  escala: EscalaDescrita;
  observaciones?: string | null;
  objetivo?: string | null;
};

export type PerfilRedaccion = "sin-datos" | "insuficiente" | "homogeneo" | "diferenciado";

export type Redaccion = {
  fortalezas: string;
  mejoras: string;
  interpretacion: string;
  /** Pocas puntuaciones o valoración parcial: revisar con especial cuidado. */
  provisional: boolean;
  perfil: PerfilRedaccion;
  version: string;
};

export const LIMITES_REDACCION = { fortalezas: 1500, mejoras: 1500, interpretacion: 2000 } as const;

// ------------------------------------------------------------- utilidades

const MAX_ELEMENTOS = 3;

/** Hash FNV-1a (32 bits): elige variantes de redacción de forma reproducible. */
function hash(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

const elegir = <T,>(opciones: readonly T[], semilla: number, sal: number): T => opciones[(semilla + sal * 7919) % opciones.length];

/** «la utiliza con autonomía…» (primera letra en minúscula, sin punto final). */
function enFrase(t: string): string {
  const s = t.trim().replace(/[.\s]+$/, "");
  return s.charAt(0).toLocaleLowerCase("es") + s.slice(1);
}

const conPunto = (t: string) => (/[.!?…»"]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);

function lista(nombres: readonly string[]): string {
  if (nombres.length <= 1) return nombres.join("");
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

const normalizar = (t: string) =>
  t
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Competencias que menciona un texto libre (por su nombre completo). */
function mencionadas(texto: string | null | undefined, notas: readonly NotaRedaccion[]): NotaRedaccion[] {
  if (!texto?.trim()) return [];
  const t = ` ${normalizar(texto).replace(/[^a-z0-9ñ ]/g, " ")} `;
  return notas.filter((n) => {
    const nombre = normalizar(n.nombre).replace(/[^a-z0-9ñ ]/g, " ").trim();
    return nombre.length >= 3 && t.includes(` ${nombre} `);
  });
}

const etiquetaNivel = (escala: EscalaDescrita, n: Nota) => `${n} · ${escala[n].nombre}`;
const media = (notas: readonly NotaRedaccion[]) => notas.reduce((s, n) => s + n.puntuacion, 0) / notas.length;
const decimal = (v: number) => v.toFixed(1).replace(".", ",");
const ordenar = (l: readonly NotaRedaccion[]) => [...l].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"));

function recortar(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  const corte = texto.lastIndexOf("\n", max - 2);
  return `${texto.slice(0, corte > 0 ? corte : max - 1).trimEnd()}…`;
}

// ------------------------------------------------------------- redacción

function lineaFortaleza(n: NotaRedaccion, escala: EscalaDescrita): string {
  const nivel = escala[n.puntuacion];
  const base = `• ${n.nombre} (${etiquetaNivel(escala, n.puntuacion)})`;
  if (n.puntuacion >= 4) return nivel.descripcion ? `${base}: ${conPunto(enFrase(nivel.descripcion))}` : `${base}.`;
  if (n.puntuacion === 3)
    return `${base}: base sólida dentro de su perfil${nivel.descripcion ? `; ${conPunto(enFrase(nivel.descripcion))}` : "."}`;
  // Nota baja en términos absolutos: solo es lo más asentado de este perfil.
  return `${base}: todavía en nivel ${nivel.nombre}, pero es de lo más asentado de su perfil actual.`;
}

function lineaMejora(n: NotaRedaccion, escala: EscalaDescrita): string {
  const base = `• ${n.nombre} (${etiquetaNivel(escala, n.puntuacion)})`;
  const criterio = n.descripcion ? ` Criterio de la metodología: ${conPunto(n.descripcion)}` : "";
  if (n.puntuacion <= 2) {
    const nivel = escala[n.puntuacion];
    return `${base}: ${nivel.descripcion ? conPunto(enFrase(nivel.descripcion)) : "es la competencia con más recorrido."}${criterio}`;
  }
  const siguiente = escala[(n.puntuacion + 1) as Nota];
  return `${base}: margen para avanzar hacia el nivel ${siguiente.nombre}.${criterio}`;
}

const INTRO_FORTALEZAS = [
  "Lo más consolidado de su perfil en esta evaluación:",
  "Destaca, en relación con el resto de sus competencias:",
  "Puntos de apoyo de su juego según las puntuaciones:",
] as const;
const INTRO_MEJORAS = [
  "Aspectos con más margen de mejora dentro de su perfil:",
  "Donde hay más recorrido, según las puntuaciones:",
  "Prioridades de mejora que se desprenden de las puntuaciones:",
] as const;

/**
 * Propuesta de redacción. Determinista: misma entrada, mismo texto.
 */
export function generarRedaccion(entrada: EntradaRedaccion): Redaccion {
  const { escala } = entrada;
  const notas = ordenar(entrada.notas);
  const total = Math.max(entrada.totalCompetencias, notas.length);
  const objetivo = entrada.objetivo?.trim() || null;
  const observaciones = entrada.observaciones?.trim() || null;
  const semilla = hash(notas.map((n) => `${n.nombre}:${n.puntuacion}`).join("|") + (observaciones ?? "") + (objetivo ?? ""));
  const vacia = (perfil: PerfilRedaccion, interpretacion: string): Redaccion => ({
    fortalezas: "",
    mejoras: "",
    interpretacion,
    provisional: true,
    perfil,
    version: VERSION_GENERADOR,
  });

  if (notas.length === 0) return vacia("sin-datos", "Todavía no hay puntuaciones: puntúa al menos una competencia para proponer una redacción.");

  const parcial = notas.length < total;
  const resumenNotas = notas.map((n) => `${n.nombre}: ${etiquetaNivel(escala, n.puntuacion)}`).join("; ");

  if (notas.length < MINIMO_NOTAS) {
    const partes = [
      `Propuesta provisional: solo hay ${notas.length} de ${total} competencias puntuadas, insuficiente para señalar fortalezas o aspectos a mejorar.`,
      `Puntuado: ${resumenNotas}.`,
      ...contexto(notas, [], observaciones, objetivo),
    ];
    return vacia("insuficiente", recortar(partes.join(" "), LIMITES_REDACCION.interpretacion));
  }

  const m = media(notas);
  const max = Math.max(...notas.map((n) => n.puntuacion)) as Nota;
  const min = Math.min(...notas.map((n) => n.puntuacion)) as Nota;
  const intro: string[] = [
    parcial
      ? `Valoración parcial: ${notas.length} de ${total} competencias puntuadas (media ${decimal(m)}).`
      : `Valoración de las ${notas.length} competencias de la metodología (media ${decimal(m)}).`,
  ];

  // Perfil homogéneo: no hay notas relativamente altas ni bajas que señalar.
  if (max === min) {
    const nivel = escala[max];
    const fortalezas =
      max >= 4
        ? `Nivel homogéneo y alto: todas las competencias puntuadas están en nivel ${nivel.nombre} (${max})${nivel.descripcion ? `: ${conPunto(enFrase(nivel.descripcion))}` : "."}`
        : max === 3
          ? `Base funcional homogénea: todas las competencias puntuadas están en nivel ${nivel.nombre} (3)${nivel.descripcion ? `: ${conPunto(enFrase(nivel.descripcion))}` : "."}`
          : "Ninguna competencia destaca por encima del resto en esta evaluación.";
    const mejoras =
      max === 5
        ? "No hay competencias por debajo del resto: el trabajo se orienta a mantener el nivel y aplicarlo en contextos más exigentes."
        : `Todas en el mismo nivel: el paso siguiente es avanzar hacia el nivel ${escala[(max + 1) as Nota].nombre} (${max + 1}). Las puntuaciones no indican por sí solas por dónde empezar; lo fija el objetivo de trabajo.`;
    const interpretacion = [
      ...intro,
      `Perfil homogéneo: ${lista(notas.map((n) => n.nombre))} en nivel ${etiquetaNivel(escala, max)}.`,
      ...contexto(notas, [], observaciones, objetivo),
    ].join(" ");
    return {
      fortalezas: recortar(fortalezas, LIMITES_REDACCION.fortalezas),
      mejoras: recortar(mejoras, LIMITES_REDACCION.mejoras),
      interpretacion: recortar(interpretacion, LIMITES_REDACCION.interpretacion),
      provisional: parcial,
      perfil: "homogeneo",
      version: VERSION_GENERADOR,
    };
  }

  // Perfil diferenciado: las notas más altas y más bajas del propio jugador.
  const altas = notas.filter((n) => n.puntuacion === max);
  const bajas = notas.filter((n) => n.puntuacion === min);
  const fortalezas = [
    elegir(INTRO_FORTALEZAS, semilla, 1),
    ...altas.slice(0, MAX_ELEMENTOS).map((n) => lineaFortaleza(n, escala)),
    ...(altas.length > MAX_ELEMENTOS ? [`• Y ${altas.length - MAX_ELEMENTOS} más en el mismo nivel.`] : []),
  ].join("\n");
  const mejoras = [
    elegir(INTRO_MEJORAS, semilla, 2),
    ...bajas.slice(0, MAX_ELEMENTOS).map((n) => lineaMejora(n, escala)),
    ...(bajas.length > MAX_ELEMENTOS ? [`• Y ${bajas.length - MAX_ELEMENTOS} más en el mismo nivel.`] : []),
  ].join("\n");

  const diferencia = max - min;
  const forma =
    diferencia === 1
      ? "Perfil bastante equilibrado, con un nivel de diferencia"
      : diferencia === 2
        ? "Perfil con diferencias claras"
        : "Perfil muy desigual";
  const interpretacion = [
    ...intro,
    `${forma} entre lo más alto (${lista(altas.slice(0, MAX_ELEMENTOS).map((n) => n.nombre))}, nivel ${escala[max].nombre}) y lo más bajo (${lista(bajas.slice(0, MAX_ELEMENTOS).map((n) => n.nombre))}, nivel ${escala[min].nombre}).`,
    ...resumenGrupos(notas, escala),
    ...contexto(notas, bajas, observaciones, objetivo),
  ].join(" ");

  return {
    fortalezas: recortar(fortalezas, LIMITES_REDACCION.fortalezas),
    mejoras: recortar(mejoras, LIMITES_REDACCION.mejoras),
    interpretacion: recortar(interpretacion, LIMITES_REDACCION.interpretacion),
    provisional: parcial,
    perfil: "diferenciado",
    version: VERSION_GENERADOR,
  };
}

/** Media por área cuando la metodología agrupa las competencias en varias áreas. */
function resumenGrupos(notas: readonly NotaRedaccion[], escala: EscalaDescrita): string[] {
  const grupos = new Map<string, NotaRedaccion[]>();
  for (const n of notas) if (n.grupo) grupos.set(n.grupo, [...(grupos.get(n.grupo) ?? []), n]);
  if (grupos.size < 2) return [];
  const medias = [...grupos].map(([g, l]) => ({ g, m: media(l) })).sort((a, b) => b.m - a.m || a.g.localeCompare(b.g, "es"));
  const alta = medias[0];
  const baja = medias[medias.length - 1];
  if (alta.m - baja.m < 1) return [];
  return [
    `Por áreas, ${alta.g} (media ${decimal(alta.m)}) queda por encima de ${baja.g} (media ${decimal(baja.m)}, cerca del nivel ${escala[Math.round(baja.m) as Nota].nombre}).`,
  ];
}

/** Observaciones y objetivo del entrenador: se relacionan, nunca se reescriben. */
function contexto(notas: readonly NotaRedaccion[], bajas: readonly NotaRedaccion[], observaciones: string | null, objetivo: string | null): string[] {
  const partes: string[] = [];
  if (observaciones) {
    const citadas = mencionadas(observaciones, notas);
    partes.push(
      citadas.length > 0
        ? `Las observaciones del entrenador/a aportan contexto sobre ${lista(citadas.map((n) => n.nombre))}; se recogen tal cual en su apartado.`
        : "Las observaciones del entrenador/a completan esta lectura y se recogen tal cual en su apartado.",
    );
  }
  if (objetivo) {
    const enObjetivo = mencionadas(objetivo, notas);
    const alineadas = enObjetivo.filter((n) => bajas.includes(n));
    partes.push(
      alineadas.length > 0
        ? `El objetivo de trabajo fijado por el entrenador/a se centra en ${lista(alineadas.map((n) => n.nombre))}, coherente con los aspectos a mejorar.`
        : "El objetivo de trabajo lo fija el entrenador/a y se indica en su apartado.",
    );
  }
  return partes;
}

// --------------------------------------------------------------- escala

/** Escala con descripciones a partir de los niveles guardados de una metodología (o solo nombres). */
export function escalaDescrita(nombres: Record<Nota, string>, niveles?: unknown): EscalaDescrita {
  const descripciones = new Map<number, string>();
  if (Array.isArray(niveles)) {
    for (const n of niveles) {
      const valor = (n as { valor?: unknown })?.valor;
      const d = (n as { descripcion?: unknown })?.descripcion;
      if (typeof valor === "number" && typeof d === "string" && d.trim()) descripciones.set(valor, d.trim());
    }
  }
  return Object.fromEntries(
    ([1, 2, 3, 4, 5] as const).map((v) => [v, { nombre: nombres[v], descripcion: descripciones.get(v) ?? null }]),
  ) as EscalaDescrita;
}

// ------------------------------------------------- propuesta guardada

export type PropuestaGuardada = { version: string; fortalezas: string; mejoras: string; interpretacion: string; provisional: boolean };

/**
 * Propuesta automática que se guarda junto a la redacción aprobada (para
 * distinguir lo generado de lo escrito o corregido). Se valida en el servidor:
 * llega del navegador. null si falta o no es válida.
 */
export function validarPropuestaGuardada(v: unknown): PropuestaGuardada | null {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const texto = (x: unknown, max: number) => (typeof x === "string" && x.length <= max ? x : null);
  const version = texto(o.version, 40);
  const fortalezas = texto(o.fortalezas, LIMITES_REDACCION.fortalezas);
  const mejoras = texto(o.mejoras, LIMITES_REDACCION.mejoras);
  const interpretacion = texto(o.interpretacion, LIMITES_REDACCION.interpretacion);
  if (!version || fortalezas === null || mejoras === null || interpretacion === null || typeof o.provisional !== "boolean") return null;
  return { version, fortalezas, mejoras, interpretacion, provisional: o.provisional };
}

/** ¿Lo guardado es exactamente la propuesta automática, o el entrenador/a lo cambió? */
export function origenRedaccion(
  guardado: { fortalezas: string | null; mejoras: string | null; interpretacion: string | null },
  propuesta: PropuestaGuardada | null,
): "propuesta" | "revisada" | "manual" {
  if (!propuesta) return "manual";
  const igual = (a: string | null, b: string) => (a ?? "").trim() === b.trim();
  return igual(guardado.fortalezas, propuesta.fortalezas) && igual(guardado.mejoras, propuesta.mejoras) && igual(guardado.interpretacion, propuesta.interpretacion)
    ? "propuesta"
    : "revisada";
}
