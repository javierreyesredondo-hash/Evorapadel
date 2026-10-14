// ESCENA 5 — Informes profesionales (14–18 s): el informe PDF REAL que genera
// ÉVORA sale de la pantalla del móvil y queda suspendido en el espacio. Se
// resaltan fortalezas, aspectos a mejorar y el objetivo de trabajo.
// Textos: «MENOS TIEMPO REDACTANDO.» y «MÁS TIEMPO ENTRENANDO.»

import { COLOR, css, ease, el, imagen, lerp, ondular, prog, titular } from "../motor.js";
import { CENTRO_MOVIL, poseMovil } from "./4-evaluacion.js";

const ANCHO = 660;
const ALTO = (ANCHO * 2339) / 1654;
const k = ANCHO / 1654; // px del PDF a 200 ppp → px del vídeo

// Zonas del informe (px del PDF renderizado a 200 ppp).
const ZONAS = {
  fortalezas: { pagina: 0, x0: 105, x1: 1545, y0: 1440, y1: 1600, texto: "Fortalezas" },
  mejoras: { pagina: 0, x0: 105, x1: 1545, y0: 1618, y1: 1815, texto: "Aspectos a mejorar" },
  objetivo: { pagina: 1, x0: 105, x1: 1545, y0: 212, y1: 372, texto: "Objetivo de trabajo" },
};

function crearPagina(n) {
  const p = el("div", "p3d", { width: `${ANCHO}px`, height: `${ALTO}px`, left: `${-ANCHO / 2}px`, top: `${-ALTO / 2}px` });
  const papel = el("div", "", {
    position: "absolute", inset: 0, borderRadius: "10px", overflow: "hidden", background: "#fff",
    boxShadow: "0 50px 120px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.4)",
  });
  papel.append(imagen(`../publico/capturas/informe-pdf-${n}.webp`, "", { width: `${ANCHO}px`, height: `${ALTO}px` }));
  const luz = el("div", "", { position: "absolute", inset: 0, background: "linear-gradient(120deg, rgba(255,255,255,0.0) 35%, rgba(255,255,255,0.35) 48%, rgba(255,255,255,0) 60%)", backgroundSize: "300% 100%", mixBlendMode: "soft-light" });
  const sombraInterior = el("div", "", { position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(16,27,44,0.18), rgba(16,27,44,0) 30%, rgba(16,27,44,0) 70%, rgba(16,27,44,0.12))" });
  papel.append(luz, sombraInterior);
  p.append(papel);
  return { p, luz };
}

function crearResalte(z) {
  const caja = el("div", "", {
    position: "absolute", left: `${z.x0 * k - 10}px`, top: `${z.y0 * k - 8}px`, width: `${(z.x1 - z.x0) * k + 20}px`, height: `${(z.y1 - z.y0) * k + 16}px`,
    borderRadius: "12px", border: `4px solid ${COLOR.lima}`, boxShadow: "0 0 30px rgba(199,255,50,0.7), inset 0 0 20px rgba(199,255,50,0.25)", opacity: 0,
  });
  const chip = el("div", "etiqueta", {
    position: "absolute", right: "-14px", top: "-30px", padding: "6px 14px", borderRadius: "999px", background: COLOR.lima, color: COLOR.noche,
    fontSize: "26px", lineHeight: 1, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", whiteSpace: "nowrap",
  }, `✓ ${z.texto}`);
  caja.append(chip);
  return caja;
}

export function escenaInformes({ ev }) {
  const raiz = el("div", "escena");
  const escenario = el("div", "escenario3d", { perspective: "1700px", perspectiveOrigin: "50% 58%" });
  const soporte = el("div", "p3d", { left: `${CENTRO_MOVIL.x}px`, top: `${CENTRO_MOVIL.y}px` });
  const paginas = [crearPagina(1), crearPagina(2)];
  const resaltes = Object.values(ZONAS).map((z) => {
    const r = crearResalte(z);
    paginas[z.pagina].p.append(r);
    return r;
  });
  soporte.append(paginas[1].p, paginas[0].p);
  escenario.append(soporte);
  const halo = el("div", "", { position: "absolute", left: "40px", top: "500px", width: "1000px", height: "1150px", borderRadius: "50%", background: "radial-gradient(closest-side, rgba(199,255,50,0.12), transparent)" });

  const titulo1 = titular([["MENOS", "TIEMPO"], ["!REDACTANDO."]], { tam: 118, estilo: { top: "290px" } });
  const titulo2 = titular([["MÁS", "TIEMPO"], ["*ENTRENANDO."]], { tam: 118, estilo: { top: "290px" } });
  const contenedor = el("div", "capa");
  contenedor.append(halo, escenario, titulo1.raiz, titulo2.raiz);
  raiz.append(contenedor);

  // Pose final de las páginas (relativa al centro del móvil en la escena 4).
  const destino1 = { x: 0, y: -90, z: 140, rx: 4, ry: -12, rz: -2, s: 1 };
  const destino2 = { x: 70, y: -140, z: 40, rx: 4, ry: -12, rz: 4, s: 0.97 };

  const poseTexto = (p) =>
    `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, ${p.z.toFixed(1)}px) rotateX(${p.rx.toFixed(2)}deg) rotateY(${p.ry.toFixed(2)}deg) rotateZ(${p.rz.toFixed(2)}deg) scale(${p.s.toFixed(4)})`;
  const mezclar = (a, b, q) => Object.fromEntries(Object.keys(a).map((c) => [c, lerp(a[c], b[c], q)]));

  return {
    raiz,
    desde: 13.95,
    hasta: 18.35,
    actualizar(t) {
      // Origen: la pantalla del móvil (misma pose y tamaño que la pantalla).
      const m = poseMovil(t);
      const desdeMovil = { x: m.x - CENTRO_MOVIL.x, y: m.y - CENTRO_MOVIL.y, z: m.z + 6, rx: m.rx, ry: m.ry, rz: m.rz, s: (m.s * 500) / ANCHO };
      const sale = ease.inOutCubic(prog(t, ev.pdfSale, ev.pdfSale + 0.75));
      const flota = { x: ondular(t, 3, 0.6) * 10, y: ondular(t, 5, 0.5) * 12, z: 0, rx: ondular(t, 6, 0.5) * 1.5, ry: ondular(t, 7, 0.4) * 3, rz: 0, s: 0 };
      // Cambio de página: la 2 pasa delante para el objetivo de trabajo.
      const cambio = ease.inOutCubic(prog(t, ev.resaltes[2] - 0.45, ev.resaltes[2] + 0.05));
      const empuje = lerp(1, 1.05, prog(t, 15.0, 17.8));
      const salida = ease.inCubic(prog(t, 17.7, 18.12));

      const p1 = mezclar(desdeMovil, destino1, sale);
      const atras = { x: -150, y: -60, z: -160, rx: 4, ry: -4, rz: -6, s: 0.92 };
      const p1f = mezclar(p1, mezclar(p1, atras, 1), cambio);
      const aparece2 = ease.outCubic(prog(t, ev.pdfSale + 0.45, ev.pdfSale + 1.0));
      const p2 = mezclar(mezclar(desdeMovil, destino2, aparece2), { x: 20, y: -80, z: 200, rx: 3, ry: -10, rz: 1, s: 1.02 }, cambio);
      const final = (p) => ({ ...p, x: p.x + flota.x, y: p.y + flota.y - salida * 200, z: p.z - salida * 700, rx: p.rx + flota.rx, ry: p.ry + flota.ry, s: p.s * empuje });
      css(paginas[0].p, { transform: poseTexto(final(p1f)), opacity: (prog(t, ev.pdfSale - 0.02, ev.pdfSale + 0.1) * (1 - salida)).toFixed(3), zIndex: cambio > 0.5 ? 1 : 2 });
      css(paginas[1].p, { transform: poseTexto(final(p2)), opacity: (aparece2 * (1 - salida)).toFixed(3), zIndex: cambio > 0.5 ? 2 : 1 });
      paginas.forEach((pg, i) => css(pg.luz, { backgroundPosition: `${(prog(t, 14.3 + i * 0.3, 17.8) * 100).toFixed(1)}% 0` }));

      // Resaltes: aparecen con un pulso y se quedan.
      resaltes.forEach((r, i) => {
        const t0 = ev.resaltes[i];
        const a = ease.outBack(prog(t, t0, t0 + 0.35));
        css(r, { opacity: prog(t, t0, t0 + 0.12).toFixed(3), transform: `scale(${lerp(1.12, 1, a).toFixed(4)})` });
      });
      css(halo, { opacity: (prog(t, 14.2, 14.8) * (1 - salida)).toFixed(3) });

      titulo1.actualizar(t, 14.3, 16.15, { escalon: 0.1 });
      titulo2.actualizar(t, 16.25, 17.95, { escalon: 0.1 });
    },
  };
}
