"use client";

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useState,
  type Dispatch,
  type ReactNode,
} from "react";
import {
  CLAVE_ALMACEN,
  deserializarEstado,
  estadoInicial,
  reducir,
  type Accion,
  type Estado,
} from "@/lib/dominio";

// Almacén de la demo. Sin base de datos todavía: el estado parte de los
// datos ficticios y se guarda solo en el localStorage de este navegador.
// Cuando llegue Supabase, este es el único módulo que debería cambiar.

type Valor = {
  estado: Estado;
  despachar: Dispatch<Accion>;
  cargado: boolean;
  /** Mensaje breve de confirmación (no se guarda). */
  aviso: string | null;
  mostrarAviso: (mensaje: string) => void;
};

const Contexto = createContext<Valor | null>(null);

type Interno = { estado: Estado; cargado: boolean };
type AccionInterna = Accion | { tipo: "leidoDelNavegador"; estado: Estado | null };

function reducirInterno(actual: Interno, accion: AccionInterna): Interno {
  if (accion.tipo === "leidoDelNavegador") {
    return { estado: accion.estado ?? actual.estado, cargado: true };
  }
  return { ...actual, estado: reducir(actual.estado, accion) };
}

export function ProveedorAlmacen({ children }: { children: ReactNode }) {
  const [{ estado, cargado }, despacharInterno] = useReducer(reducirInterno, undefined, () => ({
    estado: estadoInicial(),
    cargado: false,
  }));
  const despachar: Dispatch<Accion> = despacharInterno;
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 4000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  useEffect(() => {
    let guardado: Estado | null = null;
    try {
      guardado = deserializarEstado(window.localStorage.getItem(CLAVE_ALMACEN));
    } catch {
      // Almacenamiento bloqueado (modo privado, permisos): seguimos en memoria.
    }
    despacharInterno({ tipo: "leidoDelNavegador", estado: guardado });
  }, []);

  useEffect(() => {
    // No escribir antes de leer: pisaría lo guardado con los datos iniciales.
    if (!cargado) return;
    try {
      window.localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(estado));
    } catch {
      // Sin almacenamiento: los cambios duran hasta recargar la página.
    }
  }, [estado, cargado]);

  return (
    <Contexto.Provider value={{ estado, despachar, cargado, aviso, mostrarAviso: setAviso }}>
      {children}
    </Contexto.Provider>
  );
}

export function useAlmacen(): Valor {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("useAlmacen debe usarse dentro de <ProveedorAlmacen>");
  return valor;
}

/** Identificador único para registros creados en la demo. */
export function nuevoId(prefijo: string): string {
  // randomUUID solo existe en contextos seguros (https o localhost).
  const aleatorio =
    globalThis.crypto?.randomUUID?.().slice(0, 8) ??
    Math.random().toString(36).slice(2, 10);
  return `${prefijo}-${aleatorio}`;
}
