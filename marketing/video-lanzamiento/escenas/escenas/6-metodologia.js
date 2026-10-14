// ESCENA 6 — Metodología y control (18–22 s): paneles flotantes con la
// evolución de una jugadora, sus competencias y la decisión del entrenador
// (objetivo de trabajo), junto a pantallas REALES de metodología y gestión.
// Datos: los de la escuela de demostración (ficticia). Sin análisis
// predictivos ni inteligencia artificial: solo lo que la app hace.
// Texto: «TU METODOLOGÍA. TU CRITERIO. TUS JUGADORES.»

import { COLOR, css, ease, el, imagen, lerp, ondular, prog, svg, titular, tramos } from "../motor.js";

// Historial real de la jugadora de demostración (media de cada evaluación).
const EVOLUCION = [
  { fecha: "17 may", media: 2.5 },
  { fecha: "6 jul", media: 3.0 },
  { fecha: "20 ago", media: 3.5 },
  { fecha: "8 oct", media: 4.0 },
];
// Última evaluación (escala 1–5 de la metodología ÉVORA).
const COMPETENCIAS = [
  ["Golpes de fondo", 4],
  ["Juego en la red", 4],
  ["Juego aéreo", 3],
  ["Lectura táctica", 5],
  ["Condición física", 4],
  ["Fortaleza mental", 4],
];

function panel(x, y, ancho, alto, extra = {}) {
  return el("div", "cristal p3d", { left: `${x - ancho / 2}px`, top: `${y - alto / 2}px`, width: `${ancho}px`, height: `${alto}px`, padding: "26px 30px", ...extra });
}
const cabecera = (titulo, sub) =>
  `<div class="etiqueta" style="font-size:40px;line-height:1;color:#fff">${titulo}</div><div style="margin-top:6px;font-family:Inter;font-weight:500;font-size:21px;color:${COLOR.tenue}">${sub}</div>`;

export function escenaMetodologia({ ev }) {
  const raiz = el("div", "escena");
  const escenario = el("div", "escenario3d", { perspective: "1500px", perspectiveOrigin: "50% 55%" });
  const mundo = el("div", "p3d", { left: 0, top: 0, width: "1080px", height: "1920px" });
  escenario.append(mundo);

  // Pantallas reales al fondo: metodología (competencias) y panel de escuelas.
  const pantalla = (nombre, x, y, giro) => {
    const c = el("div", "p3d", { left: `${x - 165}px`, top: `${y - 357}px`, width: "330px", height: "714px", borderRadius: "34px", overflow: "hidden", border: "2px solid rgba(169,180,198,0.3)", boxShadow: "0 40px 90px rgba(0,0,0,0.6)" });
    c.append(imagen(`../publico/capturas/${nombre}.webp`, "", { width: "330px" }));
    c.dataset.giro = giro;
    return c;
  };
  const fondoIzq = pantalla("metodologia", 175, 1060, 28);
  const fondoDer = pantalla("admin", 905, 1090, -28);

  // A. Evolución de la jugadora.
  const A = panel(540, 935, 740, 450, { borderColor: "rgba(199,255,50,0.5)" });
  A.innerHTML = cabecera("Evolución · Lucía Martín", "Media de cada evaluación · escala 1–5");
  const G = { x0: 60, x1: 640, y0: 270, y1: 40 }; // eje: nota 1 en y0, nota 5 en y1
  const yNota = (n) => lerp(G.y0, G.y1, (n - 1) / 4);
  const xPunto = (i) => lerp(G.x0 + 30, G.x1 - 30, i / (EVOLUCION.length - 1));
  const grafica = svg("svg", { viewBox: "0 0 680 320", width: 680, height: 320 });
  grafica.style.cssText = "position:absolute;left:30px;top:118px;overflow:visible";
  const defs = svg("defs");
  const area = svg("linearGradient", { id: "evo-area", x1: 0, y1: 0, x2: 0, y2: 1 });
  area.append(svg("stop", { offset: 0, "stop-color": COLOR.lima, "stop-opacity": 0.35 }), svg("stop", { offset: 1, "stop-color": COLOR.lima, "stop-opacity": 0 }));
  const recorte = svg("clipPath", { id: "evo-recorte" });
  const rectRecorte = svg("rect", { x: 0, y: 0, width: 0, height: 320 });
  recorte.append(rectRecorte);
  defs.append(area, recorte);
  grafica.append(defs);
  for (let n = 1; n <= 5; n++) {
    grafica.append(svg("line", { x1: G.x0, x2: G.x1, y1: yNota(n), y2: yNota(n), stroke: "rgba(169,180,198,0.18)", "stroke-width": 1.5 }));
    const et = svg("text", { x: G.x0 - 18, y: yNota(n) + 8, fill: COLOR.tenue, "font-family": "Inter", "font-size": 22, "text-anchor": "end" });
    et.textContent = String(n);
    grafica.append(et);
  }
  const puntos = EVOLUCION.map((e, i) => [xPunto(i), yNota(e.media)]);
  const dLinea = puntos.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  grafica.append(svg("path", { d: `${dLinea} L${puntos.at(-1)[0]} ${G.y0} L${puntos[0][0]} ${G.y0} Z`, fill: "url(#evo-area)", "clip-path": "url(#evo-recorte)" }));
  const linea = svg("path", { d: dLinea, fill: "none", stroke: COLOR.lima, "stroke-width": 6, "stroke-linecap": "round", "stroke-linejoin": "round" });
  linea.style.filter = "drop-shadow(0 0 10px rgba(199,255,50,0.8))";
  grafica.append(linea);
  const marcas = EVOLUCION.map((e, i) => {
    const [x, y] = puntos[i];
    const g = svg("g");
    g.append(svg("circle", { cx: x, cy: y, r: 13, fill: COLOR.noche, stroke: COLOR.lima, "stroke-width": 5 }));
    const v = svg("text", { x, y: y - 26, fill: "#fff", "font-family": "Barlow Condensed", "font-weight": 800, "font-style": "italic", "font-size": 36, "text-anchor": "middle" });
    v.textContent = e.media.toFixed(1).replace(".", ",");
    const f = svg("text", { x, y: G.y0 + 40, fill: COLOR.tenue, "font-family": "Inter", "font-size": 21, "text-anchor": "middle" });
    f.textContent = e.fecha;
    g.append(v, f);
    grafica.append(g);
    return g;
  });
  const insignia = el("div", "etiqueta", { position: "absolute", right: "28px", top: "26px", padding: "8px 16px", borderRadius: "999px", background: COLOR.lima, color: COLOR.noche, fontSize: "30px", lineHeight: 1 }, "+1,5");
  A.append(grafica, insignia);

  // B. Competencias de la última evaluación (barras segmentadas, como en la app).
  const B = panel(305, 1395, 500, 420);
  B.innerHTML = cabecera("Competencias", "Última evaluación · 8 oct");
  const filas = COMPETENCIAS.map(([nombre, nota]) => {
    const fila = el("div", "", { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "16px", gap: "10px" });
    fila.append(el("div", "", { fontFamily: "Inter", fontWeight: 600, fontSize: "22px", color: "#fff", whiteSpace: "nowrap" }, nombre));
    const seg = el("div", "", { display: "flex", gap: "5px" });
    const piezas = [1, 2, 3, 4, 5].map((n) => {
      const s = el("span", "", { width: "26px", height: "16px", borderRadius: "4px", background: "rgba(255,255,255,0.12)" });
      s.dataset.lleno = n <= nota ? "1" : "0";
      seg.append(s);
      return s;
    });
    fila.append(seg);
    B.append(fila);
    return { fila, piezas, nota, nombre };
  });
  const aereo = filas[2];
  const marcoAereo = el("div", "", { position: "absolute", left: "16px", right: "16px", height: "44px", borderRadius: "12px", border: `3px solid ${COLOR.naranja}`, boxShadow: "0 0 24px rgba(255,130,76,0.55)", opacity: 0 });
  B.append(marcoAereo);

  // C. Decisión del entrenador: objetivo de trabajo (dato real de la evaluación).
  const C = panel(800, 1345, 430, 270, { borderColor: "rgba(199,255,50,0.7)" });
  C.innerHTML = `<div class="etiqueta" style="font-size:30px;color:${COLOR.lima}">Objetivo de trabajo</div><div style="margin-top:12px;font-family:Inter;font-weight:700;font-size:30px;line-height:1.2;color:#fff">Variar la bandeja: cortada y plana</div><div style="margin-top:14px;font-family:Inter;font-weight:500;font-size:21px;color:${COLOR.tenue}">Juego aéreo · Plazo: 7 dic 2026<br>Lo decide el entrenador/a</div>`;
  const flecha = svg("svg", { viewBox: "0 0 1080 1920", width: 1080, height: 1920 });
  flecha.style.cssText = "position:absolute;inset:0;overflow:visible";
  const curva = svg("path", { d: "M520 1360 C 560 1320, 560 1300, 590 1300", fill: "none", stroke: COLOR.lima, "stroke-width": 5, "stroke-linecap": "round" });
  curva.style.filter = "drop-shadow(0 0 8px rgba(199,255,50,0.9))";
  flecha.append(curva);

  // D. Indicadores de la escuela (demo): jugadores, grupos, evaluaciones.
  const indicadores = [["10", "jugadores"], ["3", "grupos"], ["14", "evaluaciones"]].map(([n, txt], i) => {
    const c = el("div", "cristal p3d", { left: `${150 + i * 300}px`, top: "1610px", width: "260px", height: "110px", padding: "14px 20px", borderRadius: "22px", display: "flex", alignItems: "baseline", gap: "12px" });
    const num = el("div", "etiqueta", { fontSize: "62px", color: COLOR.lima, lineHeight: 1 }, "0");
    c.append(num, el("div", "", { fontFamily: "Inter", fontWeight: 600, fontSize: "23px", color: "#fff" }, txt));
    return { c, num, n: Number(n) };
  });

  mundo.append(fondoIzq, fondoDer, A, B, C, ...indicadores.map((d) => d.c));
  const titulo = titular([["TU", "METODOLOGÍA."], ["TU", "CRITERIO."], ["TUS", "*JUGADORES."]], { tam: 104, estilo: { top: "280px" } });
  const contenedor = el("div", "capa");
  contenedor.append(escenario, flecha, titulo.raiz);
  raiz.append(contenedor);

  const [g0, g1, g2] = ev.graficas;
  const entradas = [
    [fondoIzq, 18.0, -500],
    [fondoDer, 18.08, -500],
    [A, 18.05, 0],
    [B, 18.2, 60],
    [C, ev.decision, 120],
  ];

  return {
    raiz,
    desde: 17.85,
    hasta: 22.3,
    actualizar(t) {
      // Converge al final hacia el centro (paso a la escena de cierre).
      const junta = ease.inExpo(prog(t, 21.55, 22.1));
      for (const [nodo, t0, z] of entradas) {
        const e = ease.outExpo(prog(t, t0, t0 + 0.7));
        const giro = Number(nodo.dataset.giro ?? 0);
        const fl = ondular(t, t0 * 7, 0.7);
        const x0 = parseFloat(nodo.style.left) + parseFloat(nodo.style.width) / 2;
        const y0 = parseFloat(nodo.style.top) + parseFloat(nodo.style.height) / 2;
        const hx = (540 - x0) * junta;
        const hy = (1000 - y0) * junta;
        css(nodo, {
          transform: `translate3d(${hx.toFixed(1)}px, ${(hy + (1 - e) * 160 + fl * 8).toFixed(1)}px, ${(lerp(-900, z, e) - junta * 600).toFixed(1)}px) rotateY(${(giro + fl * 2).toFixed(2)}deg) rotateX(${((1 - e) * 25).toFixed(2)}deg) scale(${lerp(1, 0.4, junta).toFixed(3)})`,
          opacity: (prog(t, t0, t0 + 0.25) * (z < -100 ? 0.75 : 1) * (1 - prog(t, 21.85, 22.1))).toFixed(3),
          filter: z < -100 ? "blur(1.5px) brightness(0.8)" : "none",
        });
      }
      indicadores.forEach((d, i) => {
        const t0 = 18.35 + i * 0.12;
        const e = ease.outExpo(prog(t, t0, t0 + 0.6));
        css(d.c, { transform: `translate3d(${((540 - (165 + i * 300 + 115)) * junta).toFixed(1)}px, ${((1 - e) * 120 + (1000 - 1665) * junta).toFixed(1)}px, ${(-junta * 600).toFixed(1)}px) scale(${lerp(1, 0.4, junta).toFixed(3)})`, opacity: (prog(t, t0, t0 + 0.2) * (1 - prog(t, 21.85, 22.1))).toFixed(3) });
        d.num.textContent = String(Math.round(d.n * ease.outCubic(prog(t, t0 + 0.1, t0 + 0.9))));
      });

      // Competencias: se rellenan en el primer golpe («TU METODOLOGÍA»).
      filas.forEach((f, i) => {
        f.piezas.forEach((s, n) => {
          const on = s.dataset.lleno === "1" && t >= g0 + 0.1 + i * 0.06 + n * 0.03;
          css(s, { background: on ? (f === aereo && t >= ev.decision ? COLOR.naranja : COLOR.lima) : "rgba(255,255,255,0.12)" });
        });
      });
      // Evolución: la línea se dibuja con «TU CRITERIO».
      const dib = ease.inOutCubic(prog(t, g1 - 0.1, g1 + 0.7));
      rectRecorte.setAttribute("width", (dib * 680).toFixed(1));
      const L = 600;
      linea.setAttribute("stroke-dasharray", `${L} ${L * 2}`);
      linea.setAttribute("stroke-dashoffset", ((1 - dib) * L).toFixed(1));
      marcas.forEach((m, i) => {
        const a = ease.outBack(prog(t, g1 + i * 0.18, g1 + i * 0.18 + 0.35));
        m.setAttribute("opacity", prog(t, g1 + i * 0.18, g1 + i * 0.18 + 0.1).toFixed(3));
        const [x, y] = puntos[i];
        m.setAttribute("transform", `translate(${x} ${y}) scale(${a.toFixed(3)}) translate(${-x} ${-y})`);
      });
      css(insignia, { opacity: prog(t, g2, g2 + 0.2).toFixed(3), transform: `scale(${lerp(1.4, 1, ease.outBack(prog(t, g2, g2 + 0.35))).toFixed(3)})` });
      css(A, { boxShadow: `0 30px 80px rgba(0,0,0,0.55), 0 0 ${(30 + 50 * Math.max(0, 1 - Math.abs(t - g2 - 0.2) / 0.5)).toFixed(0)}px rgba(199,255,50,0.25)` });

      // Decisión: el punto más bajo (Juego aéreo) se marca y se convierte en objetivo.
      const marca = prog(t, ev.decision - 0.15, ev.decision + 0.1);
      css(marcoAereo, { top: `${aereo.fila.offsetTop - 6}px`, opacity: (marca * (1 - prog(t, 21.85, 22.1))).toFixed(3) });
      const traza = ease.outCubic(prog(t, ev.decision, ev.decision + 0.35));
      curva.setAttribute("stroke-dasharray", "200 400");
      curva.setAttribute("stroke-dashoffset", ((1 - traza) * 200).toFixed(1));
      curva.setAttribute("opacity", (traza > 0 ? 1 - prog(t, 21.5, 21.7) : 0).toFixed(3));

      css(mundo, { transform: `rotateY(${tramos(t, [[18, -5], [22, 5]], ease.inOutSine).toFixed(2)}deg)` });
      titulo.actualizar(t, g0, 21.75, { tiempos: [g0, g0 + 0.1, g1, g1 + 0.1, g2, g2 + 0.1] });
    },
  };
}
