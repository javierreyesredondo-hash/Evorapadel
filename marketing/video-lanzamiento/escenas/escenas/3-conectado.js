// ESCENA 3 — Todo conectado (6–10 s): una escuela de pádel en 3D aparece desde
// arriba y se conectan, con líneas luminosas, jugadores, grupos,
// entrenamientos, evaluaciones e informes (miniaturas de pantallas REALES).
// Texto: «TODO TU CLUB. EN UN SOLO LUGAR.»

import { MARCA } from "/datos/marca.js";
import { COLOR, css, ease, el, lerp, ondular, prog, svg, titular, tramos } from "../motor.js";

const CENTRO = { x: 540, y: 1105 };
const RADIO = 380;

// Miniaturas: recorte (px de la captura a 3×) de pantallas reales de la app.
const NODOS = [
  { titulo: "Jugadores", dato: "10 activos", img: "jugadores-contenido", y0: 1430, icono: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { titulo: "Grupos", dato: "3 grupos", img: "grupos-contenido", y0: 900, icono: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" },
  { titulo: "Entrenamientos", dato: "Evaluar en cadena", img: "entrenamiento-contenido", y0: 1150, icono: "M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" },
  { titulo: "Evaluaciones", dato: "Escala 1–5", img: "evaluaciones-contenido", y0: 900, icono: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" },
  { titulo: "Informes", dato: "PDF familias", img: "informe-pdf-1", y0: 0, ancho: 1654, icono: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" },
];

function crearMiniPista() {
  const s = svg("svg", { viewBox: "0 0 100 200", width: 150, height: 300 });
  s.style.cssText = "position:absolute";
  s.append(
    svg("rect", { x: 0, y: 0, width: 100, height: 200, rx: 3, fill: "#173561" }),
    svg("rect", { x: 1.5, y: 1.5, width: 97, height: 197, fill: "none", stroke: "rgba(255,255,255,0.85)", "stroke-width": 1.4 }),
    svg("line", { x1: 0, y1: 30.5, x2: 100, y2: 30.5, stroke: "rgba(255,255,255,0.85)", "stroke-width": 1.4 }),
    svg("line", { x1: 0, y1: 169.5, x2: 100, y2: 169.5, stroke: "rgba(255,255,255,0.85)", "stroke-width": 1.4 }),
    svg("line", { x1: 50, y1: 30.5, x2: 50, y2: 169.5, stroke: "rgba(255,255,255,0.85)", "stroke-width": 1.4 }),
    svg("line", { x1: 0, y1: 100, x2: 100, y2: 100, stroke: COLOR.lima, "stroke-width": 2.2 }),
  );
  return s;
}

export function escenaConectado({ ev }) {
  const raiz = el("div", "escena");

  // Club en 3D: plataforma de cristal con cuatro pistas.
  const escenario = el("div", "escenario3d", { perspective: "1600px", perspectiveOrigin: `50% ${CENTRO.y / 19.2}%` });
  const plataforma = el("div", "p3d", { left: `${CENTRO.x}px`, top: `${CENTRO.y}px` });
  const base = el("div", "p3d", { width: "760px", height: "760px", left: "-380px", top: "-380px" });
  for (let i = 6; i >= 1; i--) {
    base.append(el("div", "", { position: "absolute", inset: 0, borderRadius: "48px", transform: `translateZ(${-i * 5}px)`, background: i === 1 ? "rgba(199,255,50,0.55)" : "rgba(20,32,52,0.95)" }));
  }
  base.append(el("div", "", {
    position: "absolute", inset: 0, borderRadius: "48px",
    background: "radial-gradient(circle at 50% 50%, rgba(42,61,92,0.95), rgba(16,27,44,0.98) 70%)",
    border: "2px solid rgba(199,255,50,0.6)", boxShadow: "0 0 60px rgba(199,255,50,0.25), inset 0 0 80px rgba(0,0,0,0.6)",
  }));
  [[-170, -160], [10, -160], [-170, 150], [10, 150]].forEach(([x, y]) => {
    const p = crearMiniPista();
    p.style.left = `${380 + x}px`;
    p.style.top = `${380 + y - 150}px`;
    p.style.transform = "translateZ(2px)";
    base.append(p);
  });
  // Cuadrícula técnica bajo la plataforma.
  const rejilla = el("div", "p3d", {
    width: "2400px", height: "2400px", left: "-1200px", top: "-1200px", transform: "translateZ(-60px)",
    background: "repeating-linear-gradient(0deg, rgba(199,255,50,0.07) 0 2px, transparent 2px 80px), repeating-linear-gradient(90deg, rgba(199,255,50,0.07) 0 2px, transparent 2px 80px)",
    maskImage: "radial-gradient(circle, #000 20%, transparent 60%)", WebkitMaskImage: "radial-gradient(circle, #000 20%, transparent 60%)",
  });
  plataforma.append(rejilla, base);
  escenario.append(plataforma);

  // Líneas luminosas y pulsos.
  const lineas = svg("svg", { viewBox: "0 0 1080 1920", width: 1080, height: 1920 });
  lineas.style.cssText = "position:absolute;inset:0;overflow:visible";
  const defs = svg("defs");
  const brillo = svg("filter", { id: "brillo-linea", x: "-20%", y: "-20%", width: "140%", height: "140%" });
  brillo.append(svg("feGaussianBlur", { stdDeviation: 6, result: "b" }));
  const fusion = svg("feMerge");
  fusion.append(svg("feMergeNode", { in: "b" }), svg("feMergeNode", { in: "SourceGraphic" }));
  brillo.append(fusion);
  defs.append(brillo);
  lineas.append(defs);

  const posiciones = NODOS.map((_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / NODOS.length;
    return { x: CENTRO.x + Math.cos(a) * RADIO, y: CENTRO.y + Math.sin(a) * RADIO * 1.02 };
  });
  const caminos = posiciones.map((p, i) => {
    const mx = (CENTRO.x + p.x) / 2 + (i % 2 ? 60 : -60);
    const my = (CENTRO.y + p.y) / 2 + (i % 2 ? -40 : 40);
    const d = `M${CENTRO.x} ${CENTRO.y} Q${mx} ${my} ${p.x} ${p.y}`;
    const camino = svg("path", { d, fill: "none", stroke: COLOR.lima, "stroke-width": 4, "stroke-linecap": "round", filter: "url(#brillo-linea)" });
    lineas.append(camino);
    return camino;
  });
  const anillo = posiciones.map((p, i) => {
    const q = posiciones[(i + 1) % posiciones.length];
    const camino = svg("path", { d: `M${p.x} ${p.y} L${q.x} ${q.y}`, fill: "none", stroke: "rgba(199,255,50,0.45)", "stroke-width": 2, "stroke-dasharray": "8 10" });
    lineas.insertBefore(camino, lineas.firstChild.nextSibling);
    return camino;
  });
  const pulsos = caminos.map(() => {
    const c = svg("circle", { r: 9, fill: "#f2ffd0", filter: "url(#brillo-linea)" });
    lineas.append(c);
    return c;
  });

  // Centro: símbolo de ÉVORA en un disco de cristal.
  const centro = el("div", "", {
    position: "absolute", left: `${CENTRO.x - 95}px`, top: `${CENTRO.y - 95}px`, width: "190px", height: "190px", borderRadius: "50%",
    background: "radial-gradient(circle at 40% 35%, #2a3d5c, #101b2c 70%)", border: "3px solid rgba(199,255,50,0.85)",
    boxShadow: "0 0 70px rgba(199,255,50,0.45), inset 0 0 40px rgba(0,0,0,0.5)", display: "grid", placeItems: "center",
  });
  const simbolo = svg("svg", { viewBox: "0 0 64 64", width: 130, height: 130 });
  simbolo.append(svg("path", { d: MARCA.SIMBOLO.letra, fill: "#fff" }), svg("circle", { cx: MARCA.SIMBOLO.bola.cx, cy: MARCA.SIMBOLO.bola.cy, r: MARCA.SIMBOLO.bola.r, fill: COLOR.lima }));
  simbolo.style.transform = "translate(4px, 4px)";
  centro.append(simbolo);
  const ondaCentro = el("div", "", { position: "absolute", left: `${CENTRO.x - 95}px`, top: `${CENTRO.y - 95}px`, width: "190px", height: "190px", borderRadius: "50%", border: "3px solid rgba(199,255,50,0.8)" });

  // Nodos con miniatura real.
  const tarjetas = NODOS.map((n, i) => {
    const p = posiciones[i];
    const t = el("div", "cristal lima-borde", { position: "absolute", left: `${p.x - 128}px`, top: `${p.y - 120}px`, width: "256px", padding: "16px", borderRadius: "26px" });
    const cab = el("div", "", { display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" });
    const ico = svg("svg", { viewBox: "0 0 24 24", width: 34, height: 34, fill: "none", stroke: COLOR.lima, "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" });
    ico.append(svg("path", { d: n.icono }));
    cab.append(ico, el("div", "etiqueta", { fontSize: "36px", lineHeight: 1, color: "#fff", letterSpacing: "0.5px" }, n.titulo));
    const ancho = n.ancho ?? 1170;
    const mini = el("div", "", {
      height: "118px", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.12)",
      backgroundImage: `url(../publico/capturas/${n.img}.webp)`, backgroundSize: "224px auto", backgroundPosition: `0 ${(-n.y0 * 224) / ancho}px`, backgroundColor: COLOR.noche,
    });
    const dato = el("div", "", { marginTop: "10px", fontFamily: "Inter", fontWeight: 600, fontSize: "21px", color: COLOR.lima }, n.dato);
    t.append(cab, mini, dato);
    return t;
  });

  const titulo = titular([["TODO", "TU", "CLUB."], ["EN", "UN", "SOLO", "*LUGAR."]], { tam: 112, estilo: { top: "300px" } });
  const contenedor = el("div", "capa");
  contenedor.append(escenario, lineas, ondaCentro, centro, ...tarjetas, titulo.raiz);
  raiz.append(contenedor);
  const largos = caminos.map(() => 0);

  return {
    raiz,
    desde: 5.9,
    hasta: 10.25,
    actualizar(t) {
      // La escuela baja desde arriba (vista cenital) y la cámara se inclina.
      const baja = ease.outExpo(prog(t, 5.95, 7.1));
      const inclina = tramos(t, [[5.95, 0], [7.3, 56, ease.inOutCubic], [10.2, 60]]);
      const giro = tramos(t, [[5.95, 35], [7.3, -8, ease.outCubic], [10.2, -18, ease.lineal]]);
      css(plataforma, { transform: `translate3d(0, ${lerp(-500, 0, baja).toFixed(1)}px, ${lerp(700, -80, baja).toFixed(1)}px) rotateX(${inclina.toFixed(2)}deg) rotateZ(${giro.toFixed(2)}deg)` });
      css(escenario, { opacity: ease.outCubic(prog(t, 5.95, 6.4)).toFixed(3) });

      const disco = ease.outBack(prog(t, 6.2, 6.7));
      css(centro, { transform: `scale(${disco.toFixed(4)})`, opacity: prog(t, 6.2, 6.35).toFixed(3) });
      const latido = ((t - 6.5) % 0.5 + 0.5) % 0.5 / 0.5;
      css(ondaCentro, { transform: `scale(${(1 + latido * 0.9).toFixed(3)})`, opacity: (t > 6.5 ? (1 - latido) * 0.7 : 0).toFixed(3) });

      caminos.forEach((c, i) => {
        if (!largos[i]) largos[i] = c.getTotalLength();
        const L = largos[i];
        const t0 = ev.conexiones[i];
        const p = ease.outCubic(prog(t, t0, t0 + 0.35));
        c.setAttribute("stroke-dasharray", `${L} ${L}`);
        c.setAttribute("stroke-dashoffset", ((1 - p) * L).toFixed(1));
        c.setAttribute("opacity", p > 0 ? 1 : 0);
        // Pulso que viaja del centro al nodo, en bucle, una vez conectado.
        const ciclo = t > t0 ? (((t - t0) * 1.4 + i * 0.2) % 1) : 0;
        const punto = c.getPointAtLength(ciclo * L);
        pulsos[i].setAttribute("cx", punto.x.toFixed(1));
        pulsos[i].setAttribute("cy", punto.y.toFixed(1));
        pulsos[i].setAttribute("opacity", t > t0 + 0.3 ? (Math.sin(ciclo * Math.PI) * 0.95).toFixed(3) : 0);

        const llega = prog(t, t0 + 0.2, t0 + 0.7);
        const fl = ondular(t, i * 3, 0.8) * 8;
        css(tarjetas[i], {
          transform: `translate3d(0, ${(fl + (1 - ease.outCubic(llega)) * 40).toFixed(1)}px, 0) scale(${lerp(0.55, 1, ease.outBack(llega)).toFixed(4)})`,
          opacity: ease.outCubic(llega).toFixed(3),
          boxShadow: `0 30px 80px rgba(0,0,0,0.55), 0 0 ${(40 + 60 * Math.max(0, 1 - (t - t0 - 0.3) / 0.6)).toFixed(0)}px rgba(199,255,50,${(0.16 + 0.4 * Math.max(0, 1 - (t - t0 - 0.3) / 0.6)).toFixed(3)})`,
        });
      });
      anillo.forEach((c, i) => {
        const p = prog(t, 8.3 + i * 0.08, 8.75 + i * 0.08);
        c.setAttribute("opacity", (p * 0.9).toFixed(3));
        c.setAttribute("stroke-dashoffset", (-t * 40).toFixed(1));
      });

      titulo.actualizar(t, 6.15, 9.85, { escalon: 0.08 });

      // Salida: la cámara atraviesa el centro hacia la escena 4.
      const sal = ease.inExpo(prog(t, 9.7, 10.2));
      css(contenedor, {
        transform: `scale(${(1 + sal * 1.6).toFixed(4)})`, transformOrigin: `${CENTRO.x}px ${CENTRO.y}px`,
        opacity: (1 - prog(t, 9.95, 10.2)).toFixed(3), filter: sal > 0.01 ? `blur(${(sal * 12).toFixed(1)}px)` : "none",
      });
    },
  };
}
