// Son de stade et retour haptique. Tous les sons sont synthétisés (Web Audio, aucun fichier) et désactivés
// par défaut ; l'AudioContext n'est créé qu'au premier son joué après un geste de l'utilisateur.
// Les vibrations ne demandent pas d'activation, mais se taisent si l'utilisateur réduit les animations.

import { prefersReducedMotion } from "@/lib/motion";
import { soundEnabled, storeSound } from "./sound";

export function setSound(on: boolean) {
  storeSound(on);
  // Activer le son est un geste de l'utilisateur : c'est le moment de débloquer l'audio.
  if (on) void audio()?.resume();
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = typeof window !== "undefined" ? window.AudioContext : undefined;
  if (!Ctor) return null;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = 10 ** (-18 / 20); // −18 dB : présent sans couvrir le terrain
  master.connect(ctx.destination);
  return ctx;
}

/** Joue un son si l'utilisateur l'a activé et si le navigateur sait le faire. */
function play(build: (c: AudioContext, out: GainNode, t: number) => void) {
  if (!soundEnabled()) return;
  const c = audio();
  if (!c || !master) return;
  if (c.state === "suspended") void c.resume();
  build(c, master, c.currentTime + 0.01);
}

/** Enveloppe attaque / maintien / relâchement sur un gain. */
function envelope(c: AudioContext, out: AudioNode, t: number, attack: number, hold: number, release: number, peak = 1) {
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  g.connect(out);
  return { node: g, end: t + attack + hold + release };
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function" || prefersReducedMotion()) return;
  try {
    navigator.vibrate(pattern);
  } catch {}
}

/** Coup de sifflet : sinusoïde vers 3 kHz roulée par une modulation rapide (la bille du sifflet). */
function whistle() {
  play((c, out, t) => {
    const env = envelope(c, out, t, 0.01, 0.32, 0.06, 0.8);
    const osc = c.createOscillator();
    osc.frequency.value = 3000;
    const lfo = c.createOscillator();
    lfo.frequency.value = 32;
    const depth = c.createGain();
    depth.gain.value = 200;
    lfo.connect(depth).connect(osc.frequency);
    osc.connect(env.node);
    osc.start(t);
    lfo.start(t);
    osc.stop(env.end);
    lfo.stop(env.end);
  });
}

/** Corne de stade : dents de scie légèrement désaccordées, filtrées, à l'attaque lente. */
function horn() {
  play((c, out, t) => {
    const env = envelope(c, out, t, 0.12, 0.85, 0.3, 0.5);
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    filter.connect(env.node);
    for (const f of [110, 220, 221.6]) {
      const osc = c.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = f;
      osc.connect(filter);
      osc.start(t);
      osc.stop(env.end);
    }
  });
}

/** Clic de table de marque : 8 ms de bruit filtré. */
function tickSound() {
  play((c, out, t) => {
    const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * 0.008), c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 3200;
    src.connect(filter).connect(out);
    src.start(t);
  });
}

/** Deux notes montantes (validation). */
function chime() {
  play((c, out, t) => {
    [880, 1320].forEach((f, i) => {
      const at = t + i * 0.09;
      const env = envelope(c, out, at, 0.005, 0.05, 0.18, 0.6);
      const osc = c.createOscillator();
      osc.frequency.value = f;
      osc.connect(env.node);
      osc.start(at);
      osc.stop(env.end);
    });
  });
}

/** Buzzer grave (erreur, forfait). */
function buzz() {
  play((c, out, t) => {
    const env = envelope(c, out, t, 0.005, 0.14, 0.05, 0.4);
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 700;
    filter.connect(env.node);
    const osc = c.createOscillator();
    osc.type = "square";
    osc.frequency.value = 180;
    osc.connect(filter);
    osc.start(t);
    osc.stop(env.end);
  });
}

export const fx = {
  /** But ou point marqué, vu de l'écran géant : la corne du stade. */
  score: () => horn(),
  whistle: () => whistle(),
  horn: () => horn(),
  /** +1 à la table de marque. */
  tick: () => {
    vibrate(8);
    tickSound();
  },
  /** Set gagné, match validé. */
  success: () => {
    vibrate([12, 40, 12]);
    chime();
  },
  /** Forfait, erreur. */
  error: () => {
    vibrate([30, 30, 30]);
    buzz();
  },
  /** Dépôt d'un glisser-déposer : vibration seule. */
  drop: () => vibrate(10),
};
