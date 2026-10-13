"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { claseBoton } from "@/components/ui";
import { IconCompartir, IconDescargar } from "@/components/icons";

// Descargar o compartir el PDF del informe.
//
// El PDF se pide al servidor (que lo genera con los datos guardados y comprueba
// la sesión) al abrir la página, para tenerlo listo: Safari y Chrome solo
// permiten navigator.share() dentro del gesto del usuario, sin esperas de red.
// Si el navegador no puede compartir archivos, «Compartir informe» descarga el
// PDF y explica cómo enviarlo: el botón está siempre en el mismo sitio.

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

  function descargar(aviso = "PDF descargado. Búscalo en las descargas de tu dispositivo.") {
    if (!archivo.current) return;
    const enlace = document.createElement("a");
    const href = URL.createObjectURL(archivo.current);
    enlace.href = href;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
    setMensaje(aviso);
  }

  async function compartir() {
    if (!archivo.current) return;
    if (!puedeCompartir) {
      descargar("Este navegador no permite compartir archivos: el PDF se ha descargado. Adjúntalo en WhatsApp o en el correo.");
      return;
    }
    try {
      // Solo el archivo y un título: con «text», algunas apps de iOS envían el
      // texto y descartan el PDF. El nombre del archivo ya identifica el informe.
      await navigator.share({ files: [archivo.current], title: titulo });
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
    <section aria-label="Enviar el informe" className="space-y-3 rounded-2xl bg-noche-700 p-4 ring-1 ring-electrico/40">
      <p role="status" aria-live="polite" className="text-sm text-blanco/80">
        {estado === "preparando" && "Preparando el PDF…"}
        {estado === "listo" && "PDF listo."}
        {estado === "error" && <span className="font-semibold text-naranja">No se ha podido generar el PDF. Vuelve a intentarlo.</span>}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={compartir} disabled={!listo} className={`${claseBoton.primario} w-full sm:w-auto`}>
          <IconCompartir />
          Compartir informe
        </button>
        <button type="button" onClick={() => descargar()} disabled={!listo} className={`${claseBoton.secundario} w-full sm:w-auto`}>
          <IconDescargar />
          Descargar PDF
        </button>
      </div>
      {!puedeCompartir && listo && (
        <p className="text-xs text-tenue">
          Este navegador no permite compartir archivos directamente: «Compartir informe» descarga el PDF para que lo
          adjuntes en WhatsApp o en el correo.
        </p>
      )}
      {mensaje && <p className="text-sm font-semibold text-blanco">{mensaje}</p>}
      <div className="flex flex-wrap gap-x-5 border-t border-noche-500 pt-1 text-sm">
        <a href={url} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center font-semibold text-electrico">
          Abrir PDF en otra pestaña
        </a>
        <button
          type="button"
          onClick={regenerar}
          disabled={estado === "preparando"}
          className="inline-flex min-h-11 items-center font-semibold text-electrico disabled:opacity-40"
        >
          Volver a generar
        </button>
      </div>
    </section>
  );
}
