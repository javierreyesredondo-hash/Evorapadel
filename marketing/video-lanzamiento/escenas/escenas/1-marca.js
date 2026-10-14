// ESCENA 1 — Impacto de marca (0–3 s): pista oscura que se ilumina, pala y
// pelota con luz lateral, partículas verdes y el logo original que emerge.
// Texto: «EL PÁDEL ESTÁ EVOLUCIONANDO.»

import { css, ease, el, lerp, ondular, prog, titular, tramos } from "../motor.js";
import { crearLogo, crearPala, crearPelota, crearPista } from "../piezas.js";

export function escenaMarca({ ev }) {
  const raiz = el("div", "escena");

  // Pista en perspectiva (fondo).
  const escenario = el("div", "escenario3d", { perspective: "1400px", perspectiveOrigin: "50% 34%" });
  const camara = el("div", "p3d", { left: "540px", top: "1480px" });
  const pista = crearPista();
  camara.append(pista.raiz);
  escenario.append(camara);
  const sombraPista = el("div", "capa", { background: "linear-gradient(180deg, #0a1220 0%, rgba(10,18,32,0.85) 30%, rgba(10,18,32,0.25) 47%, rgba(10,18,32,0) 60%)" });
  // Focos del pabellón: haces de luz desde arriba y bruma.
  const haz = (x, giro, ancho) =>
    el("div", "", {
      position: "absolute", left: `${x - ancho / 2}px`, top: "-200px", width: `${ancho}px`, height: "1900px", transformOrigin: "50% 0%",
      transform: `rotate(${giro}deg)`, background: "linear-gradient(180deg, rgba(210,230,255,0.22), rgba(210,230,255,0.06) 55%, rgba(210,230,255,0))",
      clipPath: "polygon(42% 0, 58% 0, 100% 100%, 0 100%)", filter: "blur(18px)", mixBlendMode: "screen",
    });
  const haces = el("div", "capa");
  haces.append(haz(220, -14, 520), haz(860, 16, 560), haz(540, 0, 380));
  const bruma = el("div", "capa", { background: "radial-gradient(90% 18% at 50% 47%, rgba(140,180,230,0.16), transparent 70%)", mixBlendMode: "screen" });

  // Pala y pelota (primer plano).
  const primerPlano = el("div", "escenario3d", { perspective: "1100px", perspectiveOrigin: "50% 60%" });
  const soportePala = el("div", "p3d", { left: "395px", top: "1390px" });
  const pala = crearPala();
  soportePala.append(pala.raiz);
  const pelota = crearPelota(124);
  const soportePelota = el("div", "", { position: "absolute", left: "770px", top: "1500px" });
  soportePelota.append(pelota.raiz);
  const sombraPala = el("div", "", { position: "absolute", left: "200px", top: "1700px", width: "400px", height: "70px", borderRadius: "50%", background: "radial-gradient(closest-side, rgba(0,0,0,0.55), transparent)", filter: "blur(6px)" });
  const sombraPelota = el("div", "", { position: "absolute", left: "700px", top: "1680px", width: "150px", height: "36px", borderRadius: "50%", background: "radial-gradient(closest-side, rgba(0,0,0,0.6), transparent)", filter: "blur(4px)" });
  primerPlano.append(sombraPala, sombraPelota, soportePala, soportePelota);

  // Logo original y titular.
  const logo = crearLogo({ ancho: 860, id: "logo-intro" });
  const cajaLogo = el("div", "", { position: "absolute", left: `${540 - logo.ancho / 2}px`, top: `${560 - logo.alto / 2}px`, filter: "drop-shadow(0 0 28px rgba(199,255,50,0.18))" });
  cajaLogo.append(logo.raiz);
  const titulo = titular([["EL", "PÁDEL", "ESTÁ"], ["*EVOLUCIONANDO."]], { tam: 122, estilo: { top: "720px" } });

  const contenedor = el("div", "capa");
  contenedor.append(escenario, sombraPista, haces, bruma, primerPlano, cajaLogo, titulo.raiz);
  raiz.append(contenedor);

  return {
    raiz,
    desde: 0,
    hasta: 3.35,
    actualizar(t) {
      // Cámara: avance lento hacia la pista.
      const z = tramos(t, [[0, -900], [3.3, -120, ease.outCubic]]);
      const inclinacion = tramos(t, [[0, 78], [3.3, 70, ease.inOutSine]]);
      css(camara, { transform: `translate3d(0, 0, ${z.toFixed(1)}px) rotateX(${inclinacion.toFixed(2)}deg) rotateZ(${lerp(-4, 1.5, t / 3.3).toFixed(2)}deg)` });
      const luz = tramos(t, [[0.1, -0.25], [2.8, 1.2, ease.inOutSine]]);
      pista.actualizar({ luzX: luz, lineaP: prog(t, 0.45, 3.1) });
      css(haces, { opacity: (ease.outCubic(prog(t, 0.2, 1.4)) * (0.75 + 0.25 * Math.sin(t * 3))).toFixed(3) });
      css(escenario, { opacity: ease.outCubic(prog(t, 0, 0.8)).toFixed(3), filter: `brightness(${lerp(0.4, 1, ease.outCubic(prog(t, 0, 1.2))).toFixed(3)})` });

      // Pala: entra girando y queda flotando; la luz lateral la recorre.
      const entrada = ease.outExpo(prog(t, 0.05, 1.3));
      const flota = ondular(t, 2, 1.2);
      css(soportePala, {
        transform: `translate3d(${lerp(-420, 0, entrada).toFixed(1)}px, ${(lerp(260, 0, entrada) + flota * 10).toFixed(1)}px, ${lerp(-300, 0, entrada).toFixed(1)}px) rotateY(${lerp(-80, -26, entrada) + t * 4}deg) rotateZ(${lerp(-40, -16, entrada).toFixed(2)}deg) rotateX(10deg) scale(1.42)`,
      });
      pala.luz(lerp(-0.3, 1.25, prog(t, 0.3, 2.9)));
      css(sombraPala, { opacity: (0.9 * entrada).toFixed(3), transform: `scaleX(${(1 - flota * 0.04).toFixed(3)})` });

      // Pelota: cae desde arriba, rebota y gira.
      const caida = tramos(t, [[0.2, -900], [0.95, 0, ease.inQuart], [1.25, -150, ease.outCubic], [1.6, 0, ease.inCubic], [1.85, -40, ease.outCubic], [2.1, 0, ease.inCubic]]);
      const flotaP = ondular(t + 1, 5, 1.4) * 6;
      css(soportePelota, { transform: `translate3d(0, ${(caida + flotaP - 40).toFixed(1)}px, 0)` });
      pelota.actualizar(t * 2.6, lerp(0.05, 0.9, prog(t, 0.3, 2.9)));
      const altura = Math.min(1, Math.abs(caida) / 600);
      css(sombraPelota, { opacity: ((1 - altura) * 0.95 * prog(t, 0.3, 0.9)).toFixed(3), transform: `scale(${(1 - altura * 0.6).toFixed(3)})` });

      // Logo: los brazos crecen de abajo arriba, cae la bola y se descubre el nombre.
      logo.estado({
        simbolo: prog(t, 0.3, 1.0),
        bolaCae: prog(t, ev.logoBola - 0.3, ev.logoBola + 0.25),
        impacto: prog(t, ev.logoBola - 0.02, ev.logoBola + 0.55),
        texto: prog(t, ev.logoTexto - 0.1, ev.logoTexto + 0.4),
        padelP: prog(t, ev.logoTexto + 0.12, ev.logoTexto + 0.6),
        brilloX: prog(t, 2.0, 2.6),
      });
      const aparece = ease.outCubic(prog(t, 0.25, 1.2));
      css(cajaLogo, { transform: `scale(${lerp(1.08, 1, aparece).toFixed(4)})`, opacity: aparece.toFixed(3) });

      titulo.actualizar(t, 1.45, 3.05, { escalon: 0.09 });

      // Salida hacia la escena 2: la cámara sube y todo se desenfoca.
      const sal = ease.inCubic(prog(t, 2.75, 3.3));
      css(contenedor, {
        transform: `translate3d(0, ${(-sal * 260).toFixed(1)}px, 0) scale(${(1 + sal * 0.12).toFixed(4)})`,
        filter: sal > 0.01 ? `blur(${(sal * 16).toFixed(2)}px)` : "none",
        opacity: (1 - sal).toFixed(3),
      });
    },
  };
}
