// Piezas reutilizables: logo original animable, pista de pádel 3D, pala,
// pelota y móvil 3D con pantalla real de la app.

import { MARCA } from "/datos/marca.js";
import { COLOR, azar, css, ease, el, imagen, lerp, prog, svg } from "./motor.js";

// ------------------------------------------------------------------- LOGO
/**
 * Logo ORIGINAL de ÉVORA PADEL (mismos trazos que la app, misma proporción).
 * Solo se anima su aparición: los brazos de la «É» crecen de abajo arriba,
 * cae la bola lima y se descubre el nombre. El resultado final es idéntico al
 * logo de la marca.
 */
export function crearLogo({ variante = "PRINCIPAL", ancho = 860, id = "logo" } = {}) {
  const m = MARCA[variante];
  const S = MARCA.SIMBOLO;
  const alto = (ancho * m.alto) / m.ancho;
  const raiz = svg("svg", { viewBox: `0 0 ${m.ancho} ${m.alto}`, width: ancho, height: alto, overflow: "visible" });
  raiz.style.overflow = "visible";
  const defs = svg("defs");
  raiz.append(defs);

  // Los cuatro trazos de la «É» (vertical y tres brazos), en el orden del trazo.
  const barras = S.letra.split("M").filter(Boolean).map((d) => `M${d}`);
  const recortes = barras.map((_, i) => {
    const cp = svg("clipPath", { id: `${id}-c${i}` });
    const r = svg("rect", { x: 0, y: 0, width: 0, height: 0 });
    cp.append(r);
    defs.append(cp);
    return r;
  });
  const grupoSimbolo = svg("g");
  const trazos = barras.map((d, i) => {
    const p = svg("path", { d, fill: COLOR.blanco, "clip-path": `url(#${id}-c${i})` });
    grupoSimbolo.append(p);
    return p;
  });
  const anillo = svg("circle", { cx: S.bola.cx, cy: S.bola.cy, r: S.bola.r, fill: "none", stroke: COLOR.lima, "stroke-width": 0.8, opacity: 0 });
  const bola = svg("circle", { cx: S.bola.cx, cy: S.bola.cy, r: S.bola.r, fill: COLOR.lima });
  grupoSimbolo.append(anillo, bola);

  const cpTexto = svg("clipPath", { id: `${id}-t` });
  const rTexto = svg("rect", { x: 60, y: 0, width: 0, height: m.alto });
  cpTexto.append(rTexto);
  const cpPadel = svg("clipPath", { id: `${id}-p` });
  const rPadel = svg("rect", { x: 60, y: 0, width: 0, height: m.alto });
  cpPadel.append(rPadel);
  defs.append(cpTexto, cpPadel);
  const evora = svg("path", { d: m.evora, fill: COLOR.blanco, "clip-path": `url(#${id}-t)` });
  const padel = svg("path", { d: m.padel, fill: COLOR.lima, "clip-path": `url(#${id}-p)` });

  // Brillo que recorre el logo (máscara con la forma exacta del logo).
  const mascara = svg("mask", { id: `${id}-m`, maskUnits: "userSpaceOnUse", x: -20, y: -20, width: m.ancho + 40, height: m.alto + 40 });
  for (const d of [S.letra, m.evora, m.padel]) mascara.append(svg("path", { d, fill: "#fff" }));
  mascara.append(svg("circle", { cx: S.bola.cx, cy: S.bola.cy, r: S.bola.r, fill: "#fff" }));
  const gradBrillo = svg("linearGradient", { id: `${id}-g`, x1: 0, x2: 1, y1: 0, y2: 0.25 });
  gradBrillo.append(
    svg("stop", { offset: "0", "stop-color": "#fff", "stop-opacity": 0 }),
    svg("stop", { offset: "0.5", "stop-color": "#fff", "stop-opacity": 0.85 }),
    svg("stop", { offset: "1", "stop-color": "#fff", "stop-opacity": 0 }),
  );
  defs.append(mascara, gradBrillo);
  const brillo = svg("rect", { x: -80, y: -10, width: 60, height: m.alto + 20, fill: `url(#${id}-g)`, mask: `url(#${id}-m)`, opacity: 0 });

  raiz.append(grupoSimbolo, evora, padel, brillo);

  return {
    raiz,
    ancho,
    alto,
    /** Ajusta el estado: cada parámetro 0→1. */
    estado({ simbolo = 1, bolaCae = 1, impacto = 0, texto = 1, padelP = 1, brilloX = -1 }) {
      // Vertical: de abajo arriba. Brazos: de izquierda a derecha, de abajo arriba.
      const tramosSimbolo = [
        [0, 0.4],
        [0.25, 0.65],
        [0.45, 0.85],
        [0.6, 1],
      ];
      const orden = [0, 3, 2, 1]; // vertical, brazo inferior, central, superior
      orden.forEach((indice, k) => {
        const [a, b] = tramosSimbolo[k];
        const p = ease.outCubic(prog(simbolo, a, b));
        const r = recortes[indice];
        if (indice === 0) {
          r.setAttribute("x", 0);
          r.setAttribute("width", 60);
          r.setAttribute("y", lerp(52, 15.5, p));
          r.setAttribute("height", lerp(0, 37, p));
        } else {
          r.setAttribute("x", 10);
          r.setAttribute("y", 0);
          r.setAttribute("height", 60);
          r.setAttribute("width", lerp(0, 46, p));
        }
      });
      trazos.forEach((t) => t.setAttribute("opacity", simbolo > 0 ? 1 : 0));
      // Bola: cae y rebota sobre su sitio.
      const y = lerp(-46, S.bola.cy, ease.muelle(bolaCae, 0.18, 2.2));
      bola.setAttribute("cy", y.toFixed(3));
      bola.setAttribute("opacity", bolaCae > 0 ? 1 : 0);
      anillo.setAttribute("r", (S.bola.r + impacto * 16).toFixed(3));
      anillo.setAttribute("opacity", (impacto > 0 && impacto < 1 ? (1 - impacto) * 0.9 : 0).toFixed(3));
      anillo.setAttribute("stroke-width", (0.9 * (1 - impacto) + 0.1).toFixed(3));
      rTexto.setAttribute("width", lerp(0, m.ancho, ease.outCubic(texto)));
      rPadel.setAttribute("width", lerp(0, m.ancho, ease.outCubic(padelP)));
      brillo.setAttribute("x", lerp(-80, m.ancho + 20, brilloX));
      brillo.setAttribute("opacity", brilloX > 0 && brilloX < 1 ? 0.9 : 0);
    },
  };
}

// --------------------------------------------------------------- PISTA 3D
/** Pista de pádel (10 × 20 m) con cristales, red y luces. 1 m = 130 px. */
export function crearPista() {
  const M = 130;
  const ancho = 10 * M;
  const largo = 20 * M;
  const raiz = el("div", "p3d", { width: `${ancho}px`, height: `${largo}px`, left: `${-ancho / 2}px`, top: `${-largo / 2}px` });

  const suelo = svg("svg", { width: ancho, height: largo, viewBox: `0 0 ${ancho} ${largo}` });
  suelo.style.position = "absolute";
  const defs = svg("defs");
  const g = svg("radialGradient", { id: "pista-suelo", cx: "50%", cy: "55%", r: "70%" });
  g.append(svg("stop", { offset: "0", "stop-color": "#1c3d6b" }), svg("stop", { offset: "0.55", "stop-color": "#122848" }), svg("stop", { offset: "1", "stop-color": "#081222" }));
  const brilloLinea = svg("linearGradient", { id: "pista-brillo", x1: 0, y1: 0, x2: 1, y2: 0 });
  defs.append(g, brilloLinea);
  const textura = svg("pattern", { id: "pista-tex", width: 8, height: 8, patternUnits: "userSpaceOnUse" });
  textura.append(svg("rect", { width: 8, height: 8, fill: "transparent" }), svg("circle", { cx: 2, cy: 2, r: 0.8, fill: "rgba(255,255,255,0.035)" }), svg("circle", { cx: 6, cy: 5, r: 0.7, fill: "rgba(0,0,0,0.12)" }));
  defs.append(textura);
  suelo.append(defs, svg("rect", { width: ancho, height: largo, fill: "url(#pista-suelo)" }), svg("rect", { width: ancho, height: largo, fill: "url(#pista-tex)" }));

  const lineas = svg("g", { stroke: "rgba(255,255,255,0.82)", "stroke-width": 7, fill: "none" });
  const s1 = 10 * M - 6.95 * M;
  const s2 = 10 * M + 6.95 * M;
  lineas.append(
    svg("rect", { x: 3.5, y: 3.5, width: ancho - 7, height: largo - 7 }),
    svg("line", { x1: 0, y1: s1, x2: ancho, y2: s1 }),
    svg("line", { x1: 0, y1: s2, x2: ancho, y2: s2 }),
    svg("line", { x1: ancho / 2, y1: s1, x2: ancho / 2, y2: s2 }),
  );
  // Luz lima que recorre las líneas («líneas luminosas»).
  const recorrido = `M${ancho / 2} ${s2} L${ancho / 2} ${s1} L0 ${s1} L0 0 L${ancho} 0 L${ancho} ${largo} L0 ${largo} L0 ${s2} L${ancho} ${s2}`;
  const luzLinea = svg("path", { d: recorrido, stroke: COLOR.lima, "stroke-width": 9, fill: "none", "stroke-linecap": "round", "stroke-dasharray": "380 12000", opacity: 0.95 });
  luzLinea.style.filter = "drop-shadow(0 0 10px rgba(199,255,50,0.9))";
  const focoLateral = svg("rect", { width: ancho, height: largo, fill: "url(#pista-luz)", opacity: 0.9 });
  const luz = svg("linearGradient", { id: "pista-luz", x1: 0, y1: 0, x2: 1, y2: 0.15 });
  const paradas = [0, 0.4, 0.5, 0.6, 1].map((o, i) => svg("stop", { offset: o, "stop-color": i === 2 ? "#cfe6ff" : "#cfe6ff", "stop-opacity": i === 2 ? 0.22 : 0 }));
  luz.append(...paradas);
  defs.append(luz);
  suelo.append(lineas, luzLinea, focoLateral);
  raiz.append(suelo);

  // Red (plano vertical en el centro).
  const red = el("div", "p3d", {
    width: `${ancho}px`, height: `${0.88 * M}px`, left: 0, top: `${10 * M - 0.88 * M}px`,
    transformOrigin: "50% 100%", transform: "rotateX(-90deg)",
    background: "repeating-linear-gradient(0deg, rgba(255,255,255,0.10) 0 2px, transparent 2px 12px), repeating-linear-gradient(90deg, rgba(255,255,255,0.10) 0 2px, transparent 2px 12px), rgba(8,14,26,0.55)",
    borderTop: "10px solid rgba(255,255,255,0.9)",
  });
  // Cristales del fondo (los dos extremos) y laterales.
  const cristal = (estilos, transform) =>
    el("div", "p3d", {
      background: "linear-gradient(100deg, rgba(160,200,255,0.015) 0%, rgba(170,210,255,0.07) 28%, rgba(255,255,255,0.0) 29%, rgba(170,210,255,0.045) 62%, rgba(160,200,255,0.0) 100%), repeating-linear-gradient(90deg, rgba(200,225,255,0.22) 0 3px, transparent 3px 260px)",
      border: "2px solid rgba(200,225,255,0.28)",
      transform,
      ...estilos,
    });
  const alto = 3 * M;
  const fondoLejos = cristal({ width: `${ancho}px`, height: `${alto}px`, left: 0, top: `${-alto}px`, transformOrigin: "50% 100%" }, "rotateX(-90deg)");
  // Laterales: de pie sobre los bordes izquierdo y derecho (el +z local apunta hacia arriba).
  const latIzq = cristal({ width: `${alto}px`, height: `${largo}px`, left: `${-alto}px`, top: 0, transformOrigin: "100% 50%" }, "rotateY(90deg)");
  const latDer = cristal({ width: `${alto}px`, height: `${largo}px`, left: `${ancho}px`, top: 0, transformOrigin: "0% 50%" }, "rotateY(-90deg)");
  raiz.append(red, fondoLejos, latIzq, latDer);

  return {
    raiz,
    /** luzX: barrido de la luz lateral (0→1); lineaP: luz recorriendo las líneas (0→1). */
    actualizar({ luzX = 0.5, lineaP = 0 }) {
      paradas[1].setAttribute("offset", Math.max(0, luzX - 0.14));
      paradas[2].setAttribute("offset", luzX);
      paradas[3].setAttribute("offset", Math.min(1, luzX + 0.14));
      luzLinea.setAttribute("stroke-dashoffset", String(-lineaP * 11000));
      luzLinea.setAttribute("opacity", lineaP > 0 && lineaP < 1 ? 0.95 : 0);
    },
  };
}

// ------------------------------------------------------------------- PALA
const CONTORNO_PALA =
  "M130,8 C205,8 256,62 256,150 C256,232 212,290 170,312 C158,318 151,328 149,342 L147,356 L113,356 L111,342 C109,328 102,318 90,312 C48,290 4,232 4,150 C4,62 55,8 130,8 Z";

/** Pala de pádel genérica (sin marcas) con grosor real (capas) y luz lateral. */
export function crearPala({ capas = 9 } = {}) {
  const raiz = el("div", "p3d", { width: "260px", height: "480px", left: "-130px", top: "-240px" });
  for (let i = capas; i >= 1; i--) {
    const capa = svg("svg", { width: 260, height: 480, viewBox: "0 0 260 480" });
    capa.style.cssText = `position:absolute;left:0;top:0;transform:translateZ(${-i * 2.4}px)`;
    const tono = 18 + Math.round((i / capas) * 10);
    capa.append(svg("path", { d: CONTORNO_PALA, fill: `rgb(${tono},${tono + 4},${tono + 12})` }));
    capa.append(svg("rect", { x: 112, y: 350, width: 36, height: 114, rx: 10, fill: `rgb(${tono},${tono + 4},${tono + 12})` }));
    raiz.append(capa);
  }
  const frente = svg("svg", { width: 260, height: 480, viewBox: "0 0 260 480" });
  frente.style.cssText = "position:absolute;left:0;top:0";
  const defs = svg("defs");
  const carbono = svg("pattern", { id: "pala-carbono", width: 10, height: 10, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
  carbono.append(svg("rect", { width: 10, height: 10, fill: "#121821" }), svg("rect", { width: 5, height: 5, fill: "#1a2230" }), svg("rect", { x: 5, y: 5, width: 5, height: 5, fill: "#1a2230" }));
  const marco = svg("linearGradient", { id: "pala-marco", x1: 0, y1: 0, x2: 1, y2: 1 });
  marco.append(svg("stop", { offset: 0, "stop-color": "#8b97a8" }), svg("stop", { offset: 0.45, "stop-color": "#2b3442" }), svg("stop", { offset: 1, "stop-color": "#596476" }));
  const luz = svg("linearGradient", { id: "pala-luz", x1: 0, y1: 0, x2: 1, y2: 0 });
  const paradas = [svg("stop", { offset: 0, "stop-color": "#fff", "stop-opacity": 0 }), svg("stop", { offset: 0.2, "stop-color": "#eaf6ff", "stop-opacity": 0.32 }), svg("stop", { offset: 0.42, "stop-color": "#fff", "stop-opacity": 0 })];
  luz.append(...paradas);
  const agujerosClip = svg("clipPath", { id: "pala-cara" });
  agujerosClip.append(svg("path", { d: CONTORNO_PALA }));
  defs.append(carbono, marco, luz, agujerosClip);
  frente.append(defs);
  frente.append(svg("path", { d: CONTORNO_PALA, fill: "url(#pala-carbono)" }));
  // Agujeros en rejilla hexagonal dentro de la zona de golpeo.
  const agujeros = svg("g", { "clip-path": "url(#pala-cara)" });
  for (let fila = 0; fila < 13; fila++) {
    for (let col = 0; col < 11; col++) {
      const x = 30 + col * 20 + (fila % 2) * 10;
      const y = 50 + fila * 18;
      const dx = (x - 130) / 104;
      const dy = (y - 158) / 118;
      if (dx * dx + dy * dy > 1) continue;
      agujeros.append(svg("circle", { cx: x, cy: y, r: 4.6, fill: "#05080d", stroke: "rgba(255,255,255,0.08)", "stroke-width": 1 }));
    }
  }
  frente.append(agujeros);
  // Abertura del corazón, marco con acento lima y empuñadura.
  frente.append(svg("path", { d: "M130,300 L146,334 L114,334 Z", fill: "#05080d" }));
  frente.append(svg("path", { d: CONTORNO_PALA, fill: "none", stroke: "url(#pala-marco)", "stroke-width": 9 }));
  frente.append(svg("path", { d: "M34,96 C52,44 92,20 130,18", fill: "none", stroke: COLOR.lima, "stroke-width": 4, "stroke-linecap": "round" }));
  const grip = svg("g");
  grip.append(svg("rect", { x: 112, y: 352, width: 36, height: 112, rx: 9, fill: "#0e131b" }));
  for (let i = 0; i < 9; i++) grip.append(svg("path", { d: `M112 ${360 + i * 12} L148 ${352 + i * 12}`, stroke: "rgba(255,255,255,0.10)", "stroke-width": 3 }));
  grip.append(svg("rect", { x: 108, y: 458, width: 44, height: 14, rx: 6, fill: "#2b3442" }));
  frente.append(grip);
  frente.append(svg("path", { d: CONTORNO_PALA, fill: "url(#pala-luz)" }));
  raiz.append(frente);
  return {
    raiz,
    luz(x) {
      paradas[0].setAttribute("offset", Math.max(0, x - 0.25));
      paradas[1].setAttribute("offset", x);
      paradas[2].setAttribute("offset", Math.min(1, x + 0.25));
    },
  };
}

// ----------------------------------------------------------------- PELOTA
export function crearPelota(tam = 120) {
  const raiz = el("div", "", { position: "absolute", width: `${tam}px`, height: `${tam}px`, left: `${-tam / 2}px`, top: `${-tam / 2}px` });
  const esfera = el("div", "", {
    position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden",
    background: "radial-gradient(circle at 34% 30%, #f6ffc8 0%, #d9ff5a 22%, #b8ef1e 48%, #6e9a0b 78%, #2c4004 100%)",
    boxShadow: "inset -10px -14px 26px rgba(0,0,0,0.45), 0 0 50px rgba(199,255,50,0.25)",
  });
  const costura = svg("svg", { viewBox: "0 0 100 100", width: tam, height: tam });
  costura.style.cssText = "position:absolute;inset:0";
  const curva = svg("path", { d: "", fill: "none", stroke: "rgba(255,255,255,0.85)", "stroke-width": 3.2, "stroke-linecap": "round" });
  costura.append(curva);
  const fieltro = svg("svg", { viewBox: "0 0 100 100", width: tam, height: tam });
  fieltro.style.cssText = "position:absolute;inset:0;mix-blend-mode:overlay;opacity:0.5";
  const r = azar(3);
  for (let i = 0; i < 140; i++) fieltro.append(svg("circle", { cx: r() * 100, cy: r() * 100, r: 0.6 + r() * 1.2, fill: r() < 0.5 ? "#fff" : "#000" }));
  const luz = el("div", "", { position: "absolute", inset: 0, borderRadius: "50%", background: "", mixBlendMode: "screen" });
  esfera.append(fieltro, costura, luz);
  raiz.append(esfera);
  return {
    raiz,
    /** giro: radianes (gira la costura); luzX: 0→1 lado iluminado. */
    actualizar(giro, luzX = 0.3) {
      // Curva de la costura sobre la esfera (a + b = 1), girada y proyectada;
      // solo se dibuja la parte visible (z > 0).
      const a = 0.7, b = 0.3, c = 2 * Math.sqrt(a * b);
      const inc = 0.5;
      const pts = [];
      let dibujando = false;
      for (let i = 0; i <= 160; i++) {
        const th = (i / 160) * Math.PI * 2;
        let x = a * Math.cos(th) + b * Math.cos(3 * th);
        let y = a * Math.sin(th) - b * Math.sin(3 * th);
        let z = c * Math.sin(2 * th);
        [x, z] = [x * Math.cos(giro) + z * Math.sin(giro), -x * Math.sin(giro) + z * Math.cos(giro)];
        [y, z] = [y * Math.cos(inc) - z * Math.sin(inc), y * Math.sin(inc) + z * Math.cos(inc)];
        if (z > 0.05) {
          pts.push(`${dibujando ? "L" : "M"}${(50 + x * 49).toFixed(2)} ${(50 + y * 49).toFixed(2)}`);
          dibujando = true;
        } else dibujando = false;
      }
      curva.setAttribute("d", pts.join(" "));
      css(luz, { background: `radial-gradient(circle at ${(luzX * 100).toFixed(1)}% 35%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 40%)` });
    },
  };
}

// -------------------------------------------------------------- MÓVIL 3D
/**
 * Móvil con grosor real (capas) y pantalla con capturas REALES de la app.
 * Pantalla de 1170 px de captura reducida a `anchoPantalla`.
 */
export function crearMovil({ anchoPantalla = 470, capas = 16, datos }) {
  const escala = anchoPantalla / 390; // px CSS de la app → px del vídeo
  const altoPantalla = 844 * escala;
  const marco = 16;
  const anchoCuerpo = anchoPantalla + marco * 2;
  const altoCuerpo = altoPantalla + marco * 2;
  const radio = 74;
  const raiz = el("div", "p3d", { width: `${anchoCuerpo}px`, height: `${altoCuerpo}px`, left: `${-anchoCuerpo / 2}px`, top: `${-altoCuerpo / 2}px` });

  for (let i = capas; i >= 1; i--) {
    const luzBorde = 30 + Math.round(Math.sin((i / capas) * Math.PI) * 50);
    raiz.append(
      el("div", "", {
        position: "absolute", inset: 0, borderRadius: `${radio}px`, transform: `translateZ(${-i * 2.6}px)`,
        background: `linear-gradient(90deg, rgb(${luzBorde + 40},${luzBorde + 46},${luzBorde + 58}), rgb(${luzBorde},${luzBorde + 6},${luzBorde + 16}) 20%, rgb(${luzBorde + 70},${luzBorde + 76},${luzBorde + 88}) 50%, rgb(${luzBorde},${luzBorde + 6},${luzBorde + 16}) 80%, rgb(${luzBorde + 40},${luzBorde + 46},${luzBorde + 58}))`,
      }),
    );
  }
  const frente = el("div", "", {
    position: "absolute", inset: 0, borderRadius: `${radio}px`,
    background: "linear-gradient(145deg, #3a4352, #12171f 30%, #06090e 60%, #2c3441)",
    boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.18)",
  });
  const pantalla = el("div", "", {
    position: "absolute", left: `${marco}px`, top: `${marco}px`, width: `${anchoPantalla}px`, height: `${altoPantalla}px`,
    borderRadius: `${radio - marco}px`, overflow: "hidden", background: COLOR.noche,
  });
  // Barra de estado del teléfono (no es parte de la app).
  const barraEstado = el("div", "", {
    position: "absolute", left: 0, right: 0, top: 0, height: `${44 * escala * 0.82}px`, zIndex: 5,
    display: "flex", justifyContent: "space-between", alignItems: "center", padding: `0 ${30 * escala}px`,
    background: COLOR.noche, fontFamily: "Inter", fontWeight: 600, fontSize: `${15 * escala}px`, color: "#fff",
  }, `<span>9:41</span><span style="display:flex;gap:${6 * escala}px;align-items:center"><span style="display:inline-block;width:${17 * escala}px;height:${10 * escala}px;border-radius:2px;background:linear-gradient(90deg,#fff 0 25%,transparent 25% 33%,#fff 33% 58%,transparent 58% 66%,#fff 66%);opacity:.9"></span><span style="display:inline-block;width:${24 * escala}px;height:${11 * escala}px;border:1.5px solid rgba(255,255,255,.8);border-radius:3px;position:relative"><span style="position:absolute;inset:1.5px;right:5px;background:#fff;border-radius:1px"></span></span></span>`);
  const isla = el("div", "", {
    position: "absolute", left: "50%", top: `${10 * escala}px`, width: `${110 * escala}px`, height: `${30 * escala}px`, marginLeft: `${-55 * escala}px`,
    borderRadius: "999px", background: "#000", zIndex: 6,
  });
  const desplazamiento = 44 * escala * 0.82; // la app empieza debajo de la barra de estado
  const contenido = el("div", "", { position: "absolute", left: 0, top: `${desplazamiento}px`, width: `${anchoPantalla}px`, height: `${altoPantalla - desplazamiento}px`, overflow: "hidden" });
  pantalla.append(contenido, barraEstado, isla);
  const reflejo = el("div", "", {
    position: "absolute", left: `${marco}px`, top: `${marco}px`, width: `${anchoPantalla}px`, height: `${altoPantalla}px`, borderRadius: `${radio - marco}px`,
    background: "linear-gradient(115deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.07) 42%, rgba(255,255,255,0.01) 52%, rgba(255,255,255,0) 60%)",
    backgroundSize: "300% 100%", pointerEvents: "none",
  });
  raiz.append(frente, pantalla, reflejo);

  // Vistas: una por captura (contenido desplazable + barras fijas superpuestas).
  const vistas = new Map();
  function vista(nombre, { abajoDe = nombre } = {}) {
    if (vistas.has(nombre)) return vistas.get(nombre);
    const med = datos[nombre] ?? datos[abajoDe];
    const capa = el("div", "", { position: "absolute", inset: 0, opacity: 0 });
    const img = imagen(`../publico/capturas/${nombre}-contenido.webp`, "", { position: "absolute", left: 0, top: 0, width: `${anchoPantalla}px` });
    capa.append(img);
    let arriba = null;
    if (med.arriba) {
      // Las capturas de la evaluación en cadena comparten la cabecera de la primera.
      const deArriba = nombre.startsWith("cadena-") ? "cadena-0" : nombre;
      arriba = imagen(`../publico/capturas/${deArriba}-arriba.webp`, "", { position: "absolute", left: 0, top: 0, width: `${anchoPantalla}px` });
      capa.append(arriba);
    }
    let abajo = null;
    if (med.abajo) {
      abajo = imagen(`../publico/capturas/${nombre}-abajo.webp`, "", { position: "absolute", left: 0, bottom: 0, width: `${anchoPantalla}px` });
      capa.append(abajo);
    }
    contenido.append(capa);
    const v = { capa, img, med, desplazar: (y) => css(img, { transform: `translate3d(0, ${(-y * escala).toFixed(2)}px, 0)` }) };
    vistas.set(nombre, v);
    return v;
  }

  return {
    raiz, pantalla, contenido, escala, anchoPantalla, altoPantalla, anchoCuerpo, altoCuerpo, desplazamiento,
    vista,
    /** Opacidad de cada vista: {nombre: 0..1}. */
    mostrar(opacidades) {
      for (const [n, v] of vistas) {
        const o = opacidades[n] ?? 0;
        css(v.capa, { opacity: o.toFixed(3), visibility: o > 0.001 ? "inherit" : "hidden" });
      }
    },
    reflejo(p) {
      css(reflejo, { backgroundPosition: `${(p * 100).toFixed(1)}% 0` });
    },
  };
}
