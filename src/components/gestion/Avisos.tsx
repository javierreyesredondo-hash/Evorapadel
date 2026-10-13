"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

// Confirmaciones breves («Jugador creado», «Cambios guardados») de las
// pantallas con datos reales. Vive en el layout privado, así que sobrevive a la
// navegación que sigue a un guardado.

type Valor = { avisar: (mensaje: string) => void };
const Contexto = createContext<Valor | null>(null);

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [aviso, setAviso] = useState<{ texto: string; n: number } | null>(null);
  const avisar = useCallback((texto: string) => setAviso((a) => ({ texto, n: (a?.n ?? 0) + 1 })), []);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 4000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  return (
    <Contexto.Provider value={{ avisar }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        data-prueba="aviso-guardado"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4 md:bottom-6"
      >
        {aviso && (
          <p key={aviso.n} className="rounded-full bg-blanco px-4 py-2 text-sm font-bold text-noche shadow-lg">
            {aviso.texto}
          </p>
        )}
      </div>
    </Contexto.Provider>
  );
}

export function useAvisos(): Valor {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("useAvisos debe usarse dentro de <ProveedorAvisos>");
  return valor;
}
