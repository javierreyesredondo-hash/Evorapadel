// ESCENA 2 — El problema (3–6 s): fichas, notas, hojas de cálculo y datos
// sueltos flotan desordenados alrededor de un entrenador. Al final todo se
// alinea y se convierte en una interfaz ordenada.
// Texto: «¿Y TU FORMA DE ENTRENAR?»

import { COLOR, azar, css, ease, el, lerp, ondular, prog, svg, titular } from "../motor.js";

const TINTA = "#22324a";
const BOLI = "#2a4f9a";

function papel(ancho, alto, fondo, html, extra = {}) {
  return el("div", "", {
    position: "absolute", width: `${ancho}px`, height: `${alto}px`, left: `${-ancho / 2}px`, top: `${-alto / 2}px`,
    background: fondo, borderRadius: "6px", padding: "18px 20px", color: TINTA, fontFamily: "Caveat", fontWeight: 700,
    fontSize: "34px", lineHeight: 1.1, boxShadow: "0 24px 50px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(0,0,0,0.05)", overflow: "hidden", ...extra,
  }, html);
}

const lineasCuaderno = "repeating-linear-gradient(180deg, transparent 0 37px, rgba(42,79,154,0.22) 37px 39px), linear-gradient(90deg, transparent 0 46px, rgba(255,90,90,0.35) 46px 48px, transparent 48px), #f6f3ea";

function crearElementos() {
  const tachado = (t) => `<span style="position:relative">${t}<span style="position:absolute;left:-4px;right:-4px;top:52%;height:3px;background:${COLOR.naranja};transform:rotate(-4deg)"></span></span>`;
  const rodeado = (t) => `<span style="display:inline-block;padding:0 8px;border:3px solid ${COLOR.naranja};border-radius:50%">${t}</span>`;
  const hoja = () => {
    const filas = [["", "Revés", "Volea", "Físico"], ["Lucía", "3", "?", "4"], ["Hugo", "2,5", "3", ""], ["Carla", "", "4", "3?"], ["Mateo", "3", "", "2"]];
    return `<table style="border-collapse:collapse;font-family:Inter;font-weight:500;font-size:19px;color:#1d2a3c">${filas
      .map((f, i) => `<tr>${f.map((c) => `<td style="border:1px solid #b8c2cf;padding:5px 9px;min-width:62px;background:${i === 0 ? "#dfe6ee" : "#fff"}">${c}</td>`).join("")}</tr>`)
      .join("")}</table>`;
  };
  return [
    // [nodo, x, y, z, rotX, rotY, rotZ]
    [papel(330, 250, lineasCuaderno, `<div style="color:${BOLI};padding-left:34px">Ficha · Lucía M.<br>Revés: ${rodeado("¿3?")}<br>Volea: mejorar<br>${tachado("Bandeja 2")}</div>`), -250, -200, 60, 8, -18, -9],
    [papel(250, 200, "#eaf8b6", "Hugo →<br>¡¡el resto!!<br><span style='font-size:28px'>(hablar con él)</span>"), 265, -240, -80, -10, 22, 7],
    [papel(270, 210, "#ffd8c4", "¿Quién faltó<br>el martes?<br><span style='color:#c2410c'>¡¡apuntar!!</span>"), 310, 60, 120, 12, -26, 10],
    [papel(400, 236, "#ffffff", hoja(), { padding: "14px" }), -235, 25, -40, -6, 26, 5],
    [papel(300, 230, lineasCuaderno, `<div style="color:${BOLI};padding-left:34px">Sesión 12/10<br>bandeja, globo…<br>¿grupos nuevos?</div>`), 40, -430, -380, 14, 8, -4],
    [papel(250, 180, "#eaf8b6", "Informe familias<br>→ ¿domingo?"), -350, 330, 200, -14, 30, -12],
    [papel(260, 170, "#ffffff", "Grupo B:<br>cambiar horario", { color: BOLI }), 330, 370, -150, 10, -20, 14],
    [papel(230, 160, "#ffd8c4", "Carla<br>evaluación ???"), -60, -130, -450, -8, -12, 18],
    [papel(290, 250, "#f6f3ea", `<div style="font-size:30px">Objetivos trim.<br>1. ………<br>2. ${tachado("volea")}<br>3. ?</div>`, { clipPath: "polygon(0 0,100% 0,100% 88%,94% 94%,86% 89%,78% 97%,66% 91%,52% 98%,40% 92%,26% 98%,12% 92%,0 97%)" }), 70, -150, 240, -10, -30, -6],
    [el("div", "", { position: "absolute", left: "-150px", top: "-50px", width: "300px", padding: "16px 22px", borderRadius: "26px 26px 26px 6px", background: "#ffffff", color: "#1d2a3c", fontFamily: "Inter", fontWeight: 500, fontSize: "26px", boxShadow: "0 24px 50px rgba(0,0,0,0.5)" }, "¿Cómo va mi hijo<br>este trimestre?"), 300, 600, 260, 0, 14, -5],
    [el("div", "etiqueta", { position: "absolute", left: "-70px", top: "-50px", width: "140px", height: "100px", display: "grid", placeItems: "center", fontSize: "70px", color: COLOR.naranja, textShadow: "0 0 30px rgba(255,130,76,0.5)" }, "¿?"), 430, -120, -260, 0, 0, 8],
    [el("div", "etiqueta", { position: "absolute", left: "-80px", top: "-45px", width: "160px", height: "90px", display: "grid", placeItems: "center", fontSize: "64px", color: "rgba(255,255,255,0.85)" }, "3,5"), -440, -60, -300, 0, 0, -10],
    [el("div", "etiqueta", { position: "absolute", left: "-80px", top: "-45px", width: "160px", height: "90px", display: "grid", placeItems: "center", fontSize: "56px", color: "rgba(255,255,255,0.75)" }, "4/5"), 440, 250, -380, 0, 0, 6],
    [el("div", "etiqueta", { position: "absolute", left: "-60px", top: "-45px", width: "120px", height: "90px", display: "grid", placeItems: "center", fontSize: "60px", color: COLOR.naranja }, "?"), -430, 620, -100, 0, 0, -14],
  ];
}

/** Silueta de entrenador (busto) con luz de contorno. */
function crearEntrenador() {
  const s = svg("svg", { viewBox: "0 0 600 760", width: 600, height: 760 });
  s.style.cssText = "position:absolute;left:240px;top:1180px;filter:drop-shadow(-5px -2px 0 rgba(150,190,255,0.30)) drop-shadow(7px -3px 10px rgba(199,255,50,0.45)) drop-shadow(0 0 60px rgba(199,255,50,0.10))";
  const g = svg("g", { fill: "#060b14" });
  g.append(
    // Cabeza con gorra
    svg("path", { d: "M300 80 C 360 80 395 125 395 190 C 395 262 352 318 300 318 C 248 318 205 262 205 190 C 205 125 240 80 300 80 Z" }),
    svg("path", { d: "M198 168 C 200 105 245 66 304 66 C 360 66 402 100 406 160 C 360 150 300 150 262 158 C 240 162 216 168 198 168 Z" }),
    svg("path", { d: "M196 166 C 160 172 128 186 118 200 C 160 196 214 186 262 176 Z" }),
    // Cuello y hombros
    svg("path", { d: "M262 300 L338 300 L346 380 L254 380 Z" }),
    svg("path", { d: "M40 760 C 50 560 120 420 300 400 C 480 420 550 560 560 760 Z" }),
  );
  // Silbato colgado (detalle de entrenador).
  g.append(svg("path", { d: "M262 392 C 270 470 300 520 318 540", stroke: "#0d1726", "stroke-width": 4, fill: "none" }));
  s.append(g);
  return s;
}

export function escenaProblema({ ev }) {
  const raiz = el("div", "escena");
  const escenario = el("div", "escenario3d", { perspective: "1300px", perspectiveOrigin: "50% 48%" });
  const mundo = el("div", "p3d", { left: "540px", top: "1000px" });
  escenario.append(mundo);
  const entrenador = crearEntrenador();
  const luzEntrenador = el("div", "", { position: "absolute", left: "140px", top: "1000px", width: "800px", height: "900px", background: "radial-gradient(closest-side, rgba(199,255,50,0.10), transparent)", filter: "blur(20px)" });

  const r = azar(21);
  const items = crearElementos().map(([nodo, x, y, z, rx, ry, rz], i) => {
    const caja = el("div", "p3d");
    // Cara «interfaz» en la que se convierte cada elemento al ordenarse.
    const cara = el("div", "", {
      position: "absolute", left: "-130px", top: "-78px", width: "260px", height: "156px", borderRadius: "22px", opacity: 0,
      background: "linear-gradient(155deg, #22375a, #16243a 60%)", border: "1.5px solid rgba(199,255,50,0.45)",
      boxShadow: "0 20px 50px rgba(0,0,0,0.5), 0 0 30px rgba(199,255,50,0.10)", padding: "18px",
    }, `<div style="height:14px;width:${90 + (i % 3) * 30}px;border-radius:7px;background:${COLOR.lima}"></div><div style="margin-top:16px;height:10px;width:190px;border-radius:5px;background:rgba(255,255,255,0.35)"></div><div style="margin-top:12px;height:10px;width:${120 + (i % 4) * 18}px;border-radius:5px;background:rgba(255,255,255,0.2)"></div><div style="margin-top:14px;display:flex;gap:6px">${[1, 2, 3, 4, 5].map((n) => `<span style="width:30px;height:12px;border-radius:3px;background:${n <= 2 + (i % 3) ? COLOR.lima : "rgba(255,255,255,0.15)"}"></span>`).join("")}</div>`);
    caja.append(nodo, cara);
    mundo.append(caja);
    const col = i % 3;
    const fila = Math.floor(i / 3);
    return { caja, nodo, cara, x, y, z, rx, ry, rz, fase: r() * 10, gx: (col - 1) * 300, gy: (fila - 2) * 190 + 40, retraso: r() * 0.18 };
  });

  const titulo = titular([["¿Y", "TU", "FORMA"], ["DE", "*ENTRENAR?"]], { tam: 132, estilo: { top: "300px" } });
  const contenedor = el("div", "capa");
  contenedor.append(luzEntrenador, entrenador, escenario, titulo.raiz);
  raiz.append(contenedor);

  return {
    raiz,
    desde: 2.75,
    hasta: 6.35,
    actualizar(t) {
      const entra = ease.outExpo(prog(t, 2.85, 3.7));
      const orden = ev.ordenar;
      for (const it of items) {
        const o = ease.inOutCubic(prog(t, orden + it.retraso, orden + 0.55 + it.retraso));
        const deriva = (t - 3) * 18;
        const fx = it.x * (0.35 + 0.65 * entra) + ondular(t, it.fase, 0.7) * 22 + Math.sign(it.x) * deriva;
        const fy = it.y * (0.35 + 0.65 * entra) + ondular(t, it.fase + 3, 0.6) * 18 + Math.sign(it.y) * deriva * 0.4;
        const fz = lerp(-900, it.z, entra);
        const x = lerp(fx, it.gx, o);
        const y = lerp(fy, it.gy, o);
        const zz = lerp(fz, 0, o);
        // Entran dando vueltas (caos) y quedan suspendidos, girando despacio.
        const vuelta = (1 - entra) * (it.fase > 5 ? 1 : -1);
        const rx = lerp(it.rx + ondular(t, it.fase + 1, 0.5) * 12 + vuelta * 160, 0, o);
        const ry = lerp(it.ry + ondular(t, it.fase + 2, 0.5) * 16 + vuelta * 120, 0, o);
        const rz = lerp(it.rz + ondular(t, it.fase + 4, 0.4) * 9 + vuelta * 220 + (t - 3) * (it.fase - 5) * 1.6, 0, o);
        const esc = lerp(1.22, 0.95, o);
        // Profundidad de campo: lo que está lejos del plano de foco, desenfocado.
        const desenfoque = Math.min(9, Math.abs(zz - 40) / 60) * (1 - o);
        css(it.caja, {
          transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${zz.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg) scale(${esc.toFixed(3)})`,
          filter: desenfoque > 0.3 ? `blur(${desenfoque.toFixed(1)}px)` : "none",
          opacity: entra.toFixed(3),
        });
        const cambio = ease.inOutCubic(prog(t, orden + 0.25 + it.retraso, orden + 0.6 + it.retraso));
        css(it.nodo, { opacity: (1 - cambio).toFixed(3) });
        css(it.cara, { opacity: cambio.toFixed(3) });
      }
      // Cámara: ligero balanceo; al final atraviesa la interfaz hacia la escena 3.
      const atraviesa = ease.inExpo(prog(t, 5.85, 6.3));
      css(mundo, { transform: `translate3d(0, 0, ${(atraviesa * 1100).toFixed(1)}px) rotateY(${(ondular(t, 9, 0.5) * 4).toFixed(2)}deg) rotateX(${(ondular(t, 7, 0.4) * 3).toFixed(2)}deg)` });
      const silueta = ease.outCubic(prog(t, 2.95, 3.7)) * (1 - ease.inCubic(prog(t, orden, orden + 0.5)));
      css(entrenador, { opacity: silueta.toFixed(3), transform: `translate3d(0, ${((1 - silueta) * 80).toFixed(1)}px, 0)` });
      css(luzEntrenador, { opacity: silueta.toFixed(3) });
      titulo.actualizar(t, 3.3, 5.35, { escalon: 0.08 });
      css(contenedor, { opacity: (1 - prog(t, 6.0, 6.3)).toFixed(3), filter: atraviesa > 0.01 ? `blur(${(atraviesa * 10).toFixed(1)}px)` : "none" });
    },
  };
}
