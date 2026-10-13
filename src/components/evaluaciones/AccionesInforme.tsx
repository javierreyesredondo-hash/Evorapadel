"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { claseBoton } from "@/components/ui";

// Descargar o compartir el PDF del informe.
//
// El PDF se pide al servidor (que lo genera con los datos guardados y comprueba
// la sesión) al abrir la página, para tenerlo listo: Safari y Chrome solo
// permiten navigator.share() dentro del gesto del usuario, sin esperas de red.
// Si el navegador no puede compartir archivos, se ofrece la descarga.

type Estado = "preparando" | "listo" | "error";

export function AccionesInforme({ url, nombreArchivo, titulo }: { url: string; nombreArchivo: string; titulo: string }) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("preparando");
  const [puedeCompartir, setPuedeCompartir] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const archivo = useRef<File | null>(null);

  // Cada «Volver a generar» incrementa el intento y vuelve a pedir el PDF.
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    fetch(url, { cache: "no-store", credentials: "same-origin" })
      .then(async (r) => {
        if (!r.ok || r.headers.get("content-type") !== "application/pdf") throw new Error(String(r.status));
        return new File([await r.blob()], nombreArchivo, { type: "application/pdf" });
      })
      .then((pdf) => {
        if (!vigente) return;
        archivo.current = pdf;
        setPuedeCompartir(typeof navigator.canShare === "function" && navigator.canShare({ files: [pdf] }));
        setEstado("listo");
      })
      .catch(() => {
        if (!vigente) return;
        archivo.current = null;
        setEstado("error");
      });
    return () => {
      vigente = false;
    };
  }, [url, nombreArchivo, intento]);

  function descargar() {
    if (!archivo.current) return;
    const enlace = document.createElement("a");
    const href = URL.createObjectURL(archivo.current);
    enlace.href = href;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
    setMensaje("PDF descargado. Búscalo en las descargas de tu dispositivo.");
  }

  async function compartir() {
    if (!archivo.current) return;
    try {
      await navigator.share({ files: [archivo.current], title: titulo, text: titulo });
      setMensaje("Informe compartido.");
    } catch (e) {
      // Cancelar el menú de compartir no es un error.
      if ((e as Error).name !== "AbortError") setMensaje("No se ha podido compartir. Descarga el PDF y envíalo desde WhatsApp.");
    }
  }

  function regenerar() {
    setEstado("preparando");
    setMensaje(null);
    router.refresh();
    setIntento((n) => n + 1);
  }

  const listo = estado === "listo";
  return (
    <div className="space-y-3">
      <p role="status" aria-live="polite" className="text-sm text-tenue">
        {estado === "preparando" && "Preparando el PDF…"}
        {estado === "listo" && "PDF listo."}
        {estado === "error" && <span className="font-semibold text-naranja">No se ha podido generar el PDF. Vuelve a intentarlo.</span>}
      </p>
      <div className="flex flex-wrap gap-3">
        {puedeCompartir && (
          <button type="button" onClick={compartir} disabled={!listo} className={claseBoton.primario}>
            Compartir (WhatsApp…)
          </button>
        )}
        <button type="button" onClick={descargar} disabled={!listo} className={puedeCompartir ? claseBoton.secundario : claseBoton.primario}>
          Descargar PDF
        </button>
        <a href={url} target="_blank" rel="noopener" className={claseBoton.secundario}>
          Abrir PDF
        </a>
        <button type="button" onClick={regenerar} disabled={estado === "preparando"} className={claseBoton.secundario}>
          Volver a generar
        </button>
      </div>
      {!puedeCompartir && listo && (
        <p className="text-xs text-tenue">
          Este navegador no permite compartir archivos directamente. Descarga el PDF y adjúntalo en WhatsApp.
        </p>
      )}
      {mensaje && <p className="text-sm font-semibold text-blanco">{mensaje}</p>}
    </div>
  );
}
