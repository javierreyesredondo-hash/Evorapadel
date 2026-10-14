// ESCENA 7 — Cierre (22–28 s): sobre azul noche, una línea lima recorre la
// pantalla y descubre el logo ORIGINAL. Debajo, el lema y el cierre.
// Textos: «ÉVORA PADEL» (el logo), «OBSERVA. MIDE. HAZ CRECER.» y
// «LA EVOLUCIÓN DE TU ESCUELA EMPIEZA AQUÍ.». El logo queda visible hasta el final.

import { COLOR, css, ease, el, lerp, prog, titular } from "../motor.js";
import { crearLogo } from "../piezas.js";

export function escenaCierre({ ev }) {
  const raiz = el("div", "escena");
  const fondo = el("div", "capa", { background: "radial-gradient(80% 45% at 50% 46%, #1b2e4b 0%, #101b2c 60%, #0b1422 100%)" });
  const resplandor = el("div", "", { position: "absolute", left: "40px", top: "520px", width: "1000px", height: "700px", borderRadius: "50%", background: "radial-gradient(closest-side, rgba(199,255,50,0.16), rgba(199,255,50,0.04) 55%, transparent)" });

  const logo = crearLogo({ ancho: 900, id: "logo-cierre" });
  const yLogo = 830;
  const cajaLogo = el("div", "", { position: "absolute", left: `${540 - logo.ancho / 2}px`, top: `${yLogo - logo.alto / 2}px`, filter: "drop-shadow(0 0 30px rgba(199,255,50,0.22))" });
  cajaLogo.append(logo.raiz);

  // Línea lima que cruza la pantalla y descubre el logo a su paso.
  const linea = el("div", "", { position: "absolute", left: 0, top: `${yLogo - 2}px`, width: "1080px", height: "4px", background: `linear-gradient(90deg, transparent, ${COLOR.lima} 70%, #f4ffd6)`, boxShadow: "0 0 24px rgba(199,255,50,0.9), 0 0 60px rgba(199,255,50,0.5)", transformOrigin: "0 50%" });
  const chispa = el("div", "", { position: "absolute", width: "180px", height: "180px", marginLeft: "-90px", marginTop: "-90px", top: `${yLogo}px`, borderRadius: "50%", background: "radial-gradient(closest-side, rgba(244,255,214,0.95), rgba(199,255,50,0.4) 35%, transparent)" });
  const subrayado = el("div", "", { position: "absolute", left: "390px", top: `${yLogo + 125}px`, width: "300px", height: "6px", borderRadius: "3px", background: COLOR.lima, boxShadow: "0 0 18px rgba(199,255,50,0.7)", transformOrigin: "50% 50%" });

  const lema = titular([["OBSERVA.", "MIDE."], ["*HAZ", "*CRECER."]], { tam: 128, estilo: { top: "1000px" } });
  const cierre = el("div", "", {
    position: "absolute", left: "60px", right: "60px", top: "1300px", textAlign: "center", fontFamily: "Inter", fontWeight: 600,
    fontSize: "46px", lineHeight: 1.3, letterSpacing: "3px", textTransform: "uppercase", color: "rgba(255,255,255,0.88)",
  }, "La evolución de tu escuela<br><span style='color:#C7FF32'>empieza aquí.</span>");

  const contenedor = el("div", "capa");
  contenedor.append(fondo, resplandor, cajaLogo, subrayado, linea, chispa, lema.raiz, cierre);
  raiz.append(contenedor);

  return {
    raiz,
    desde: 21.95,
    hasta: 28.1,
    actualizar(t) {
      css(fondo, { opacity: ease.outCubic(prog(t, 21.95, 22.3)).toFixed(3) });
      // Barrido de la línea (izquierda → derecha) y logo descubierto a su paso.
      const t0 = ev.lineaCierre;
      const barrido = ease.inOutCubic(prog(t, t0 - 0.25, t0 + 0.45));
      const xLinea = lerp(-80, 1160, barrido);
      css(linea, { transform: `scaleX(${(xLinea / 1080).toFixed(4)})`, opacity: (barrido > 0 ? 1 - prog(t, t0 + 0.45, t0 + 0.9) : 0).toFixed(3) });
      css(chispa, { left: `${xLinea.toFixed(1)}px`, opacity: (barrido > 0 && barrido < 1 ? 1 : 0).toFixed(3) });
      const descubre = prog(xLinea, 540 - logo.ancho / 2, 540 + logo.ancho / 2);
      logo.estado({ simbolo: prog(descubre, 0, 0.2) * 1, bolaCae: prog(t, t0 - 0.05, t0 + 0.45), impacto: prog(t, t0 + 0.15, t0 + 0.75), texto: prog(descubre, 0.15, 0.75), padelP: prog(descubre, 0.55, 1), brilloX: prog(t, 25.3, 26.0) });
      css(cajaLogo, { clipPath: `inset(-60px ${(Math.max(0, 1 - descubre) * 100).toFixed(2)}% -60px -60px)` });
      const sub = ease.outExpo(prog(t, t0 + 0.4, t0 + 1.0));
      css(subrayado, { transform: `scaleX(${sub.toFixed(4)})`, opacity: sub.toFixed(3) });
      css(resplandor, { opacity: (ease.outCubic(prog(t, t0, t0 + 1)) * (0.85 + 0.15 * Math.sin(t * 2.2))).toFixed(3) });

      lema.actualizar(t, ev.lema, 99, { tiempos: [ev.lema, ev.lema + 0.25, ev.lema + 0.5, ev.lema + 0.6], dur: 0.6 });
      const c = ease.outCubic(prog(t, ev.cierreSecundario, ev.cierreSecundario + 0.7));
      css(cierre, { opacity: c.toFixed(3), transform: `translate3d(0, ${((1 - c) * 30).toFixed(1)}px, 0)`, filter: c < 0.99 ? `blur(${((1 - c) * 8).toFixed(2)}px)` : "none" });

      // Leve acercamiento continuo hasta el final.
      css(contenedor, { transform: `scale(${lerp(1, 1.035, ease.inOutSine(prog(t, 22.4, 28))).toFixed(4)})` });
    },
  };
}
