#!/usr/bin/env python3
"""Banda sonora ORIGINAL del vídeo de ÉVORA PADEL (síntesis propia, sin muestras).

Música electrónica cinematográfica a 120 ppm en re menor y efectos de sonido
(impactos, barridos, pulsos digitales) sincronizados con linea-temporal.json.
Todo se genera aquí con numpy/scipy: no hay grabaciones ni música de terceros,
así que el audio puede publicarse comercialmente sin licencias externas.

    python3 audio/componer.py            → salida/musica.wav (48 kHz, 24 bits, −14 LUFS)

Requisitos: Python 3, numpy, scipy y ffmpeg (para medir y ajustar la sonoridad).
"""

import json
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from scipy import signal

RAIZ = Path(__file__).resolve().parent.parent
LINEA = json.loads((RAIZ / "linea-temporal.json").read_text())
EV = LINEA["eventos"]
SR = 48000
DUR = float(LINEA["duracion"])
N = int(DUR * SR)
BEAT = 60.0 / LINEA["bpm"]  # 0,5 s
rng = np.random.default_rng(2026)

# Buses estéreo: seco y envío a reverberación.
seco = np.zeros((2, N))
envio = np.zeros((2, N))
duck = np.ones(N)  # «sidechain»: lo que se agacha con el bombo


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def t_arr(dur):
    return np.arange(int(dur * SR)) / SR


def sos(tipo, f, orden=2):
    if tipo == "bp":
        return signal.butter(orden, f, btype="bandpass", fs=SR, output="sos")
    return signal.butter(orden, f, btype=tipo, fs=SR, output="sos")


def filtrar(x, tipo, f, orden=2):
    return signal.sosfilt(sos(tipo, f, orden), x)


def barrido(x, tipo, f0, f1, bloque=512, orden=2, curva=2.0):
    """Filtro con frecuencia que cambia en el tiempo (por bloques, con estado)."""
    y = np.zeros_like(x)
    n = len(x)
    zi = None
    for i in range(0, n, bloque):
        p = (i / max(1, n - 1)) ** (1 / curva) if f1 > f0 else (i / max(1, n - 1)) ** curva
        f = f0 * (f1 / f0) ** p
        if tipo == "bp":
            s = sos("bp", [max(30, f / 1.6), min(SR / 2 - 100, f * 1.6)], orden)
        else:
            s = sos(tipo, min(SR / 2 - 100, max(20, f)), orden)
        if zi is None or zi.shape != (s.shape[0], 2):
            zi = np.zeros((s.shape[0], 2))
        y[i : i + bloque], zi = signal.sosfilt(s, x[i : i + bloque], zi=zi)
    return y


def sierra(f, dur, detune=0.0, fase=None):
    """Diente de sierra con polyBLEP (sin aliasing audible)."""
    n = int(dur * SR)
    f = np.full(n, f) if np.isscalar(f) else f[:n]
    f = f * 2 ** (detune / 1200)
    dt = f / SR
    ph = (np.cumsum(dt) + (rng.random() if fase is None else fase)) % 1.0
    y = 2 * ph - 1
    m1 = ph < dt
    t1 = ph[m1] / dt[m1]
    y[m1] -= t1 + t1 - t1 * t1 - 1
    m2 = ph > 1 - dt
    t2 = (ph[m2] - 1) / dt[m2]
    y[m2] -= t2 * t2 + t2 + t2 + 1
    return y


def adsr(n, a, d, s, r, sr=SR):
    a, d, r = int(a * sr), int(d * sr), int(r * sr)
    e = np.full(n, s, dtype=float)
    a = min(a, n)
    e[:a] = np.linspace(0, 1, a, endpoint=False) if a else e[:a]
    d2 = min(d, n - a)
    if d2 > 0:
        e[a : a + d2] = np.linspace(1, s, d2, endpoint=False)
    if r > 0 and n > r:
        e[n - r :] *= np.linspace(1, 0, r)
    return e


def poner(x, t0, gan=1.0, pan=0.0, rev=0.0, agacha=False):
    """Mezcla x (mono o estéreo) en t0 s con panorama (-1…1) y envío a reverb."""
    i = int(round(t0 * SR))
    if x.ndim == 1:
        izq = np.cos((pan + 1) * np.pi / 4)
        der = np.sin((pan + 1) * np.pi / 4)
        x = np.vstack([x * izq, x * der]) * np.sqrt(2)
    j0, j1 = max(0, i), min(N, i + x.shape[1])
    if j1 <= j0:
        return
    seg = x[:, j0 - i : j1 - i] * gan
    if agacha:
        seg = seg * duck[j0:j1]
    seco[:, j0:j1] += seg
    if rev:
        envio[:, j0:j1] += seg * rev


# ------------------------------------------------------------------ armonía
ACORDES = {
    "Dm": [50, 57, 62, 65, 69],
    "Bb": [46, 53, 58, 62, 65],
    "F": [53, 57, 60, 65, 69],
    "C": [48, 55, 60, 64, 67],
    "Dt": [50, 56, 62, 65, 68],  # tensión (tritono) para «el problema»
}
RAICES = {"Dm": 38, "Bb": 34, "F": 41, "C": 36, "Dt": 38}
# Un acorde por compás (2 s).
COMPASES = ["Dm", "Dm", "Dt", "Dm", "Bb", "F", "C", "Dm", "Bb", "F", "C", "Bb", "C", "F"]


def acorde(t):
    return COMPASES[min(len(COMPASES) - 1, int(t // 2))]


# ------------------------------------------------------------------- bombo
def bombo(t0, gan=1.0, largo=0.42):
    tt = t_arr(largo)
    f = 48 + 110 * np.exp(-tt * 28)
    fase = 2 * np.pi * np.cumsum(f) / SR
    cuerpo = np.sin(fase) * np.exp(-tt * 7.5)
    click = filtrar(rng.standard_normal(len(tt)), "hp", 2500) * np.exp(-tt * 180) * 0.25
    poner(np.tanh((cuerpo + click * 1.6) * 1.6) * 0.62, t0, gan)
    # El resto de la mezcla se agacha con cada bombo.
    i = int(t0 * SR)
    n = int(0.32 * SR)
    j1 = min(N, i + n)
    if i < N:
        curva = 1 - 0.62 * np.exp(-np.arange(j1 - i) / SR / 0.09)
        duck[i:j1] = np.minimum(duck[i:j1], curva)


def palmada(t0, gan=1.0):
    n = int(0.35 * SR)
    tt = np.arange(n) / SR
    ruido = rng.standard_normal(n)
    env = np.zeros(n)
    for k, d in enumerate([0, 0.011, 0.022]):
        j = int(d * SR)
        env[j:] += np.exp(-(tt[: n - j]) * (70 if k < 2 else 16))
    x = filtrar(ruido * env, "bp", [900, 5200]) * 0.7
    poner(x, t0, gan, pan=0.0, rev=0.35)


def caja(t0, gan=1.0):
    n = int(0.25 * SR)
    tt = np.arange(n) / SR
    tono = np.sin(2 * np.pi * 190 * tt) * np.exp(-tt * 30) * 0.5
    ruido = filtrar(rng.standard_normal(n), "bp", [1500, 9000]) * np.exp(-tt * 22)
    poner(tono + ruido * 0.6, t0, gan, rev=0.25)


def platillo(t0, gan=1.0, abierto=False, pan=0.0):
    largo = 0.32 if abierto else 0.06
    n = int(largo * SR)
    tt = np.arange(n) / SR
    x = filtrar(rng.standard_normal(n), "hp", 7500, 4) * np.exp(-tt * (11 if abierto else 70))
    poner(x, t0, gan * 0.5, pan=pan, rev=0.08, agacha=True)


def crash(t0, gan=1.0, largo=2.2):
    n = int(largo * SR)
    tt = np.arange(n) / SR
    x = filtrar(rng.standard_normal((2, n)), "bp", [3000, 9000], 2) * np.exp(-tt * 3.0)
    poner(x * 0.22, t0, gan, rev=0.4)


def impacto(t0, gan=1.0, largo=2.6):
    """Golpe cinematográfico: subgrave que cae, cuerpo de ruido y cola."""
    n = int(largo * SR)
    tt = np.arange(n) / SR
    f = 32 + 60 * np.exp(-tt * 6)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 1.7)
    golpe = filtrar(rng.standard_normal(n), "lp", 900) * np.exp(-tt * 9) * 0.8
    poner(np.tanh((boom * 0.7 + golpe) * 1.4) * 0.75, t0, gan, rev=0.5)
    crash(t0, gan * 0.3, largo * 0.8)


def barrido_aire(t_centro, dur=0.8, gan=1.0, sube=True, pan_de=-0.6, pan_a=0.6):
    """«Whoosh»: ruido filtrado que sube (o baja) y se mueve en el panorama."""
    n = int(dur * SR)
    x = rng.standard_normal(n)
    x = barrido(x, "bp", 300 if sube else 6000, 6000 if sube else 300, curva=1.4)
    env = np.sin(np.linspace(0, np.pi, n)) ** 2.2
    if sube:
        env = env * np.linspace(0.6, 1, n)
    pan = np.linspace(pan_de, pan_a, n)
    izq = np.cos((pan + 1) * np.pi / 4)
    der = np.sin((pan + 1) * np.pi / 4)
    est = np.vstack([x * env * izq, x * env * der]) * np.sqrt(2) * 0.5
    poner(est, t_centro - dur * 0.7, gan, rev=0.3)


def subida(t0, t1, gan=1.0):
    """Riser: ruido que se abre + tono que sube, hasta t1."""
    dur = t1 - t0
    n = int(dur * SR)
    tt = np.arange(n) / SR
    ruido = barrido(rng.standard_normal(n), "bp", 400, 9000, curva=0.7)
    f = 220 * 2 ** (tt / dur * 2)
    tono = (sierra(f, dur, 0) + sierra(f, dur, 12)) * 0.12
    tono = barrido(tono, "lp", 600, 7000, curva=0.6)
    env = (tt / dur) ** 2.2
    poner((ruido * 0.45 + tono) * env, t0, gan, rev=0.35)


def ping(t0, midi, gan=1.0, pan=0.0, largo=0.5):
    """Pulso digital (campana FM breve) afinado en la tonalidad."""
    tt = t_arr(largo)
    f = hz(midi)
    mod = np.sin(2 * np.pi * f * 2 * tt) * 1.2 * np.exp(-tt * 18)
    x = np.sin(2 * np.pi * f * tt + mod) * np.exp(-tt * 9)
    x += np.sin(2 * np.pi * f * 2 * tt) * np.exp(-tt * 25) * 0.25
    poner(x * 0.32, t0, gan, pan=pan, rev=0.35)


def tic(t0, gan=1.0, pan=0.0, f=3200):
    n = int(0.03 * SR)
    tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * tt) * np.exp(-tt * 260) + filtrar(rng.standard_normal(n), "hp", 4000) * np.exp(-tt * 400) * 0.3
    poner(x * 0.5, t0, gan, pan=pan, rev=0.1)


def papel(t0, dur, gan=1.0):
    """Revoloteo de papeles: ráfagas cortas de ruido filtrado."""
    k = int(dur * 34)
    for _ in range(k):
        t = t0 + rng.random() * dur
        n = int((0.01 + rng.random() * 0.03) * SR)
        x = filtrar(rng.standard_normal(n), "bp", [1200 + rng.random() * 2000, 7000]) * np.hanning(n)
        poner(x * 0.18, t, gan * (0.4 + rng.random() * 0.6), pan=rng.uniform(-0.8, 0.8))


# -------------------------------------------------------------- instrumentos
def pad(t0, dur, notas, gan=1.0, brillo=(900, 2600), ataque=0.35, rel=0.8, voces=3):
    tt = t_arr(dur + rel)
    total = np.zeros((2, len(tt)))
    for m in notas:
        for v in range(voces):
            det = (v - (voces - 1) / 2) * 9
            x = sierra(hz(m), dur + rel, det)
            pan = (v / max(1, voces - 1)) * 1.6 - 0.8
            total[0] += x * np.cos((pan + 1) * np.pi / 4)
            total[1] += x * np.sin((pan + 1) * np.pi / 4)
    for c in range(2):
        total[c] = barrido(total[c], "lp", brillo[0], brillo[1], curva=1.2)
    env = adsr(len(tt), ataque, 0.3, 0.85, rel)
    total = filtrar(total, "hp", 160)
    poner(total * env / (len(notas) * voces) * 1.6, t0, gan, rev=0.45, agacha=True)


def bajo(t0, dur, midi, gan=1.0, corte=520):
    tt = t_arr(dur)
    x = sierra(hz(midi), dur, 0) * 0.6 + sierra(hz(midi), dur, 7) * 0.4
    x = filtrar(x, "lp", corte, 2)
    sub = np.sin(2 * np.pi * hz(midi) * tt) * 0.45
    env = adsr(len(tt), 0.004, 0.12, 0.6, min(0.05, dur * 0.3))
    poner(np.tanh((x * 1.0 + sub) * env * 1.6) * 0.62, t0, gan, agacha=True)


def pulsacion(t0, midi, gan=1.0, corte=2400, pan=0.0, largo=0.22):
    tt = t_arr(largo)
    x = sierra(hz(midi), largo, 0) * 0.5 + sierra(hz(midi), largo, 8) * 0.5
    x = barrido(x, "lp", corte, 300, bloque=256, curva=1.0)
    x *= np.exp(-tt * 14)
    poner(x * 0.5, t0, gan, pan=pan, rev=0.25, agacha=True)
    # Eco ping-pong de corchea con puntillo.
    for k, (p, g) in enumerate([(-pan or -0.5, 0.32), (pan or 0.5, 0.16), (-pan or -0.5, 0.08)]):
        poner(x * 0.5 * g, t0 + (k + 1) * 0.375, gan, pan=p, rev=0.3, agacha=True)


def campana(t0, midi, dur, gan=1.0):
    tt = t_arr(dur + 0.6)
    f = hz(midi)
    mod = np.sin(2 * np.pi * f * 3.5 * tt) * 1.6 * np.exp(-tt * 6)
    x = np.sin(2 * np.pi * f * tt + mod) * np.exp(-tt * 3.2)
    x += np.sin(2 * np.pi * f * 2 * tt) * np.exp(-tt * 5) * 0.2
    poner(x * 0.38, t0, gan, pan=0.15, rev=0.55)


# =================================================================== ARREGLO
# 0–3 s · Marca: impacto, pad que respira, latido y arpegio filtrado.
impacto(0.0, 1.0, 3.0)
pad(0.0, 3.0, ACORDES["Dm"], 1.4, brillo=(700, 2600), ataque=0.4)
for b in np.arange(0.5, 3.0, 1.0):
    bombo(b, 0.55, 0.5)
for i, tt in enumerate(np.arange(1.0, 3.0, 0.125)):
    notas = [62, 69, 65, 74, 69, 65, 74, 69]
    pulsacion(tt, notas[i % 8], 0.8 * (0.45 + 0.55 * (tt - 1) / 2), corte=1100 + 1800 * (tt - 1) / 2, pan=0.4 if i % 2 else -0.4)
ping(EV["logoBola"], 86, 1.0, 0.1, 1.2)  # la bola del logo cae: re6
ping(EV["logoBola"] + 0.02, 74, 0.6, -0.1, 1.2)
bombo(EV["logoBola"], 0.5, 0.4)
barrido_aire(2.95, 0.7, 0.9)

# 3–6 s · El problema: tensión, papeles, reloj y subida al «drop».
impacto(3.0, 0.55, 1.6)
pad(3.0, 3.0, ACORDES["Dt"], 1.1, brillo=(500, 1800), ataque=0.15)
for tt in np.arange(3.0, 6.0, 0.25):
    bajo(tt + 0.125, 0.11, 38, 0.45, corte=300)
for tt in np.arange(3.0, 6.0, 0.125):
    tic(tt, 0.35 if (tt * 8) % 2 else 0.6, pan=0.3 if (tt * 8) % 2 else -0.3, f=2600)
papel(3.0, 0.9, 1.0)
subida(4.4, 6.0, 0.9)
redoble = list(np.arange(5.0, 5.5, 0.125)) + list(np.arange(5.5, 5.875, 0.0625)) + list(np.arange(5.875, 6.0, 0.03125))
for k, tt in enumerate(redoble):
    caja(tt, 0.25 + 0.5 * k / len(redoble))
for k in range(7):  # todo se ordena: clics ascendentes
    tic(EV["ordenar"] + k * 0.07, 0.7, pan=-0.6 + k * 0.2, f=1800 + k * 260)
barrido_aire(5.95, 0.6, 1.0, pan_de=0.6, pan_a=-0.6)

# 6–22 s · Todo conectado: entra el ritmo completo.
impacto(6.0, 0.95, 2.4)
for c in range(3, 11):
    t0 = c * 2.0
    nombre = COMPASES[c]
    pad(t0, 2.0, ACORDES[nombre], 1.15, brillo=(1400, 3600), ataque=0.06, rel=0.4)
    for k in range(4):
        tb = t0 + k * BEAT
        if not (c == 10 and tb >= 21.75):
            bombo(tb, 0.95)
        bajo(tb + 0.25, 0.22, RAICES[nombre], 0.85)
        if k in (1, 3) and not (c == 10 and tb >= 21.75):
            palmada(tb, 0.5)
    for k in range(4):  # charles abierto a contratiempo, cerrado en semicorcheas
        if not (c == 10 and t0 + k * BEAT >= 21.75):
            platillo(t0 + k * BEAT + 0.25, 0.42, abierto=True, pan=0.25)
    for k in range(16):
        tc = t0 + k * 0.125
        if not (c == 10 and tc >= 21.75) and k % 4 != 2:
            platillo(tc, 0.16 if k % 2 else 0.24, pan=-0.25)
    tonos = ACORDES[nombre]
    patron = [tonos[2] + 12, tonos[3] + 12, tonos[4] + 12, tonos[3] + 12, tonos[2] + 24, tonos[4] + 12, tonos[3] + 12, tonos[4] + 12]
    for k in range(16):
        tc = t0 + k * 0.125
        if c == 10 and tc >= 21.75:
            continue
        pulsacion(tc, patron[k % 8], 0.7, corte=2600, pan=0.45 if k % 2 else -0.45)
for tt in (10.0, 14.0, 18.0):
    crash(tt, 0.55, 1.8)
    barrido_aire(tt - 0.02, 0.55, 0.6)
# Motivo melódico (14–22 s).
MOTIVO = [(14.0, 69, 0.5), (14.5, 74, 0.5), (15.0, 77, 0.75), (15.75, 76, 0.25), (16.0, 74, 0.5), (16.5, 72, 0.5), (17.0, 69, 1.0),
          (18.0, 69, 0.5), (18.5, 72, 0.5), (19.0, 77, 0.75), (19.75, 79, 0.25), (20.0, 76, 0.5), (20.5, 74, 0.5), (21.0, 72, 0.75)]
for t0, m, d in MOTIVO:
    campana(t0, m + 12, d, 0.9)
subida(20.4, 22.0, 1.0)
redoble = list(np.arange(21.0, 21.5, 0.125)) + list(np.arange(21.5, 21.75, 0.0625))
for k, tt in enumerate(redoble):
    caja(tt, 0.3 + 0.5 * k / len(redoble))

# Pulsos digitales sincronizados con la imagen.
for k, tt in enumerate(EV["conexiones"]):
    ping(tt, [74, 77, 81, 84, 86][k], 0.8, pan=[-0.5, 0.5, 0.3, -0.3, 0][k])
for k, tt in enumerate(EV["toques"]):
    tic(tt, 0.9, pan=0.1, f=2400)
    ping(tt, [74, 74, 72, 77, 74, 74][k] + 12, 0.45, pan=0.1, largo=0.3)
for k, tt in enumerate(EV["propuesta"]):
    ping(tt, [81, 84, 86][k], 0.7, pan=[-0.4, 0, 0.4][k], largo=0.7)
barrido_aire(EV["pdfSale"] + 0.25, 0.7, 0.9, pan_de=-0.3, pan_a=0.5)
for k, tt in enumerate(EV["resaltes"]):
    ping(tt, [86, 89, 93][k], 0.75, pan=0.2, largo=0.8)
for k, tt in enumerate(EV["graficas"]):
    ping(tt, [77, 81, 84][k], 0.7, pan=[-0.3, 0.3, 0][k])
ping(EV["decision"], 86, 0.8)
ping(EV["decision"] + 0.12, 89, 0.6)

# 22–28 s · Cierre: gran impacto, línea, lema y resolución en Fa mayor.
impacto(22.0, 1.15, 4.0)
barrido_aire(EV["lineaCierre"] + 0.3, 0.75, 1.0, pan_de=-0.9, pan_a=0.9)
pad(22.0, 2.0, ACORDES["Bb"], 0.95, brillo=(1800, 3800), ataque=0.03, rel=0.6)
pad(24.0, 2.0, ACORDES["C"], 0.95, brillo=(2000, 4200), ataque=0.2, rel=0.6)
pad(26.0, 2.0, ACORDES["F"] + [72, 77], 1.0, brillo=(2400, 5200), ataque=0.25, rel=1.2)
for tt in np.arange(22.0, 28.0, 1.0):
    bajo(tt, 0.9, RAICES[acorde(tt)], 0.55, corte=300)
bombo(EV["lema"], 0.8, 0.6)
impacto(EV["lema"], 0.45, 2.0)
for tt in np.arange(23.0, 27.5, 0.25):
    tonos = ACORDES[acorde(tt)]
    pulsacion(tt, tonos[int(tt * 4) % 5] + 24, 0.32, corte=5000, pan=0.6 if int(tt * 4) % 2 else -0.6, largo=0.3)
ping(EV["cierreSecundario"], 89, 0.6, largo=1.4)
ping(25.3, 93, 0.5, largo=1.6)  # brillo del logo
campana(26.0, 77 + 12, 1.5, 0.8)

# ================================================================== MEZCLA
def reverberacion(x, dur=2.6):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    ir = rng.standard_normal((2, n)) * np.exp(-tt * 3.1)
    ir = filtrar(ir, "lp", 6500)
    ir[:, : int(0.018 * SR)] = 0
    ir /= np.sqrt((ir**2).sum(axis=1, keepdims=True))
    return np.vstack([signal.fftconvolve(x[c], ir[c])[:N] for c in range(2)])


mezcla = seco + reverberacion(envio) * 0.55
mezcla = filtrar(mezcla, "hp", 28)
# Final: la cola se desvanece en los dos últimos segundos.
fin = np.ones(N)
k0 = int(26.3 * SR)
fin[k0:] = np.linspace(1, 0, N - k0) ** 1.6
mezcla *= fin
# Entrada sin clic.
mezcla[:, :240] *= np.linspace(0, 1, 240)
mezcla /= np.max(np.abs(mezcla)) + 1e-9
mezcla = np.tanh(mezcla * 1.6) / np.tanh(1.6)  # saturación suave (cola del «limiter»)

salida = RAIZ / "salida"
salida.mkdir(exist_ok=True)
crudo = salida / "musica-sin-normalizar.wav"
final = salida / "musica.wav"


def escribir(ruta, x):
    datos = (np.clip(x.T, -1, 1) * (2**23 - 1)).astype(np.int32)
    b = np.zeros((datos.shape[0], 2, 3), dtype=np.uint8)
    for k in range(3):
        b[:, :, k] = (datos >> (8 * k)) & 0xFF
    with wave.open(str(ruta), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(3)
        w.setframerate(SR)
        w.writeframes(b.tobytes())


escribir(crudo, mezcla * 0.9)

# Sonoridad para redes: −14 LUFS integrados, pico real ≤ −1 dBTP (dos pasadas).
medida = subprocess.run(
    ["ffmpeg", "-hide_banner", "-i", str(crudo), "-af", "loudnorm=I=-14:TP=-1:LRA=11:print_format=json", "-f", "null", "-"],
    capture_output=True, text=True,
).stderr
j = json.loads(medida[medida.rindex("{") : medida.rindex("}") + 1])
filtro = (
    f"loudnorm=I=-14:TP=-1:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:"
    f"measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true"
)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(crudo), "-af", filtro, "-ar", str(SR), "-c:a", "pcm_s24le", str(final)], check=True)
crudo.unlink()
print(f"✓ {final}  ({DUR:.1f} s, entrada {j['input_i']} LUFS → −14 LUFS)", file=sys.stderr)
