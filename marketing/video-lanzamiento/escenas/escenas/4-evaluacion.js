// ESCENA 4 — Evaluación inteligente (10–14 s): móvil 3D con la evaluación en
// cadena REAL de ÉVORA. Se puntúan las competencias de 1 a 5 (seis toques) y
// la propuesta automática de fortalezas, aspectos a mejorar e interpretación
// técnica se separa de la pantalla en capas.
// Textos: «CONOCE A CADA JUGADOR.» y «EVALÚA. COMPRENDE. MEJORA.»
//
// El móvil sigue en pantalla durante la escena 5 (informes): su pose está en
// poseMovil(t), que también usa 5-informes.js.

import { COLOR, css, ease, el, lerp, ondular, prog, suave, titular, tramos } from "../motor.js";
import { crearMovil } from "../piezas.js";

export const CENTRO_MOVIL = { x: 540, y: 1150 };

/** Pose del móvil en cada instante (10–18,3 s). */
export function poseMovil(t) {
  const entra = ease.outExpo(prog(t, 9.95, 10.75));
  const aparta = ease.inOutCubic(prog(t, 14.0, 14.7));
  const sale = ease.inCubic(prog(t, 17.7, 18.12));
  const x = tramos(t, [[12.4, 540], [13.3, 470], [14.0, 470], [14.7, 330, ease.inOutCubic]]);
  const y = lerp(1900, CENTRO_MOVIL.y, entra) + aparta * 190 + ondular(t, 4, 0.9) * 10;
  const ry = tramos(t, [[9.95, -70], [10.75, -18, ease.outExpo], [12.4, -9, ease.inOutSine], [13.3, -30, ease.inOutCubic], [14.0, -32], [14.7, 24, ease.inOutCubic], [17.8, 30, ease.lineal]]);
  const rx = lerp(22, 6, entra) + aparta * 6 + ondular(t, 8, 0.7) * 1.5;
  const rz = lerp(-12, 0, entra) + ondular(t, 2, 0.6) * 1.2 + aparta * -4;
  const z = lerp(-700, 0, entra) - sale * 900;
  const s = lerp(1, 0.8, aparta);
  return { x, y, z, rx, ry, rz, s, opacidad: 1 - sale };
}

// Botón de cada nota (px CSS de la app): las cinco notas se reparten a lo ancho.
const xNota = (n) => 58 + (n - 1) * 68.25;

export function escenaEvaluacion({ capturas, ev }) {
  const raiz = el("div", "escena");
  const escenario = el("div", "escenario3d", { perspective: "1700px", perspectiveOrigin: "50% 58%" });
  const soporte = el("div", "p3d", { left: `${CENTRO_MOVIL.x}px`, top: `${CENTRO_MOVIL.y}px` });
  const movil = crearMovil({ anchoPantalla: 500, datos: capturas });
  soporte.append(movil.raiz);
  escenario.append(soporte);
  const sombra = el("div", "", { position: "absolute", width: "560px", height: "90px", borderRadius: "50%", background: "radial-gradient(closest-side, rgba(0,0,0,0.6), transparent)", filter: "blur(10px)" });
  const halo = el("div", "", { position: "absolute", width: "900px", height: "1300px", borderRadius: "50%", background: "radial-gradient(closest-side, rgba(199,255,50,0.13), rgba(199,255,50,0.03) 60%, transparent)" });

  // Vistas reales del móvil: cadena 0…6 (una por nota) e informe (escena 5).
  const vistasCadena = [0, 1, 2, 3, 4, 5, 6].map((k) => movil.vista(`cadena-${k}`));
  const vistaInforme = movil.vista("informe");
  const zonas = capturas.cadenaZonas;
  const NOTAS = [4, 4, 3, 5, 4, 4];

  // Indicador de toque (dedo) dentro de la pantalla.
  const toque = el("div", "", { position: "absolute", width: "58px", height: "58px", borderRadius: "50%", background: "rgba(255,255,255,0.32)", border: "2px solid rgba(255,255,255,0.7)", zIndex: 4, opacity: 0 });
  const onda = el("div", "", { position: "absolute", width: "58px", height: "58px", borderRadius: "50%", border: `3px solid ${COLOR.lima}`, zIndex: 4, opacity: 0 });
  movil.pantalla.append(toque, onda);
  const oscurecer = el("div", "", { position: "absolute", inset: 0, background: "#050a14", opacity: 0, zIndex: 3 });
  movil.pantalla.append(oscurecer);

  // Capas de la propuesta automática (recortes reales de la pantalla).
  const tramosPropuesta = [
    [zonas.fortalezas - 8, zonas.mejoras - 8],
    [zonas.mejoras - 8, zonas.interpretacion - 8],
    [zonas.interpretacion - 8, zonas.interpretacion + 140],
  ];
  const capas = tramosPropuesta.map(([y0, y1]) => {
    const alto = (y1 - y0) * movil.escala;
    const c = el("div", "", {
      position: "absolute", width: `${movil.anchoPantalla}px`, height: `${alto}px`, left: `${-movil.anchoPantalla / 2}px`, top: `${-alto / 2}px`,
      backgroundImage: "url(../publico/capturas/cadena-6-contenido.webp)", backgroundSize: `${movil.anchoPantalla}px auto`,
      backgroundPosition: `0 ${(-y0 * movil.escala).toFixed(1)}px`, backgroundColor: COLOR.noche, borderRadius: "20px",
      border: "2px solid rgba(199,255,50,0.7)", boxShadow: "0 30px 70px rgba(0,0,0,0.6), 0 0 40px rgba(199,255,50,0.25)", opacity: 0,
    });
    soporte.append(c);
    return { c, y0, y1, alto };
  });

  const titulo1 = titular([["CONOCE", "A"], ["CADA", "*JUGADOR."]], { tam: 118, estilo: { top: "290px" } });
  const titulo2 = titular([["EVALÚA.", "COMPRENDE."], ["*MEJORA."]], { tam: 118, estilo: { top: "290px" } });
  const contenedor = el("div", "capa");
  contenedor.append(halo, sombra, escenario, titulo1.raiz, titulo2.raiz);
  raiz.append(contenedor);

  // Desplazamiento de la pantalla (px CSS): acompaña a cada toque y baja a la propuesta.
  const desplazamientos = [[10.3, 0], [10.8, 150], [11.05, 250], [11.3, 370], [11.65, 510], [11.95, 670], [12.2, 790], [12.42, 830], [13.05, 1690], [14.0, 1720]];

  return {
    raiz,
    desde: 9.9,
    hasta: 18.35,
    actualizar(t) {
      const p = poseMovil(t);
      css(soporte, { transform: `translate3d(${(p.x - CENTRO_MOVIL.x).toFixed(1)}px, ${(p.y - CENTRO_MOVIL.y).toFixed(1)}px, ${p.z.toFixed(1)}px) rotateX(${p.rx.toFixed(2)}deg) rotateY(${p.ry.toFixed(2)}deg) rotateZ(${p.rz.toFixed(2)}deg) scale(${p.s.toFixed(4)})` });
      css(escenario, { opacity: p.opacidad.toFixed(3) });
      css(sombra, { left: `${p.x - 280}px`, top: `${p.y + 560 * p.s}px`, opacity: (0.9 * p.opacidad * prog(t, 10.1, 10.6)).toFixed(3), transform: `scale(${p.s.toFixed(3)})` });
      css(halo, { left: `${p.x - 450}px`, top: `${p.y - 650}px`, opacity: (p.opacidad * prog(t, 10.0, 10.7)).toFixed(3) });
      movil.reflejo(prog(p.ry, -40, 40));

      // Pantalla: qué captura se ve y con qué desplazamiento.
      const S = suave(t, desplazamientos);
      const opac = {};
      vistasCadena.forEach((v, k) => {
        const desde = k === 0 ? -1 : ev.toques[k - 1];
        const hasta = k === 6 ? 99 : ev.toques[k];
        opac[`cadena-${k}`] = Math.min(prog(t, desde, desde + 0.06), 1 - prog(t, hasta, hasta + 0.06)) * (1 - prog(t, 14.05, 14.3));
        v.desplazar(S);
      });
      opac.informe = prog(t, 14.05, 14.3);
      vistaInforme.desplazar(tramos(t, [[14.3, 0], [15.5, 120], [17.5, 160]]));
      movil.mostrar(opac);

      // Toques: posición del botón de la nota en pantalla.
      let activo = -1;
      ev.toques.forEach((tt, k) => {
        if (t >= tt - 0.12 && t <= tt + 0.3) activo = k;
      });
      if (activo >= 0) {
        const tt = ev.toques[activo];
        const z = zonas.tarjetas[activo];
        const xb = xNota(NOTAS[activo]) * movil.escala;
        const yb = movil.desplazamiento + (z.y + z.alto - 37 - S) * movil.escala;
        const pulsa = prog(t, tt - 0.12, tt);
        const suelta = prog(t, tt + 0.08, tt + 0.3);
        css(toque, { left: `${(xb - 29).toFixed(1)}px`, top: `${(yb - 29).toFixed(1)}px`, opacity: (Math.min(pulsa, 1 - suelta) * 0.95).toFixed(3), transform: `scale(${lerp(1.3, 0.85, ease.outCubic(pulsa)).toFixed(3)})` });
        const o = prog(t, tt, tt + 0.35);
        css(onda, { left: `${(xb - 29).toFixed(1)}px`, top: `${(yb - 29).toFixed(1)}px`, opacity: (o > 0 && o < 1 ? 1 - o : 0).toFixed(3), transform: `scale(${(1 + o * 1.6).toFixed(3)})` });
      } else {
        css(toque, { opacity: 0 });
        css(onda, { opacity: 0 });
      }

      // Capas de la propuesta: salen de la pantalla hacia la cámara.
      const ancla = -movil.altoCuerpo / 2 + 16 + movil.desplazamiento;
      const destinos = [[60, -300, 150], [110, -60, 240], [160, 190, 330]];
      capas.forEach((c, i) => {
        const t0 = ev.propuesta[i];
        const sube = ease.outCubic(prog(t, t0, t0 + 0.5));
        const vuelve = ease.inCubic(prog(t, 13.85, 14.15));
        const k = sube * (1 - vuelve);
        const yPantalla = ancla + (c.y0 - S) * movil.escala + c.alto / 2;
        const [dx, dy, dz] = destinos[i];
        css(c.c, {
          transform: `translate3d(${(dx * k).toFixed(1)}px, ${lerp(yPantalla, dy, k).toFixed(1)}px, ${(dz * k + 2).toFixed(1)}px) scale(${lerp(1, 1.1, k).toFixed(4)})`,
          opacity: (prog(t, t0 - 0.02, t0 + 0.08) * (1 - prog(t, 14.0, 14.15))).toFixed(3),
        });
      });
      css(oscurecer, { opacity: (ease.outCubic(prog(t, 12.75, 13.3)) * 0.55 * (1 - prog(t, 13.85, 14.1))).toFixed(3) });

      titulo1.actualizar(t, 10.2, 11.95, { escalon: 0.09 });
      titulo2.actualizar(t, 12.05, 13.95, { escalon: 0.45, dur: 0.5 });
    },
  };
}
