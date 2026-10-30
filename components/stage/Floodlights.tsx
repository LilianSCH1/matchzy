"use client";

import { useEffect, useRef } from "react";

// Projecteurs volumétriques en WebGL2 (un seul shader plein cadre, sans bibliothèque).
// Chargé à part (next/dynamic) et seulement si l'appareil le permet : voir FloodlightsLoader.

const VERT = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uIgnite;
uniform vec2 uAim;
uniform float uIntensity;
out vec4 o;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
// Cône de lumière de src vers target : intense au cœur, qui s'élargit et s'atténue avec la distance.
float beam(vec2 uv, vec2 src, vec2 target, float spread) {
  vec2 dir = normalize(target - src);
  vec2 d = uv - src;
  float along = dot(d, dir);
  if (along < 0.0) return 0.0;
  float across = abs(d.x * dir.y - d.y * dir.x);
  float core = smoothstep(spread * along + 0.015, 0.0, across);
  return core * core * exp(-along * 1.1);
}
void main() {
  float ar = uRes.x / uRes.y;
  vec2 uv = gl_FragCoord.xy / uRes.y;
  vec2 l = vec2(0.06 * ar, 1.08);
  vec2 r = vec2(0.94 * ar, 1.08);
  float sway = sin(uTime * 0.15) * 0.05;
  vec2 tl = vec2((0.42 + uAim.x * 0.22) * ar + sway, uAim.y * 0.2);
  vec2 tr = vec2((0.58 + uAim.x * 0.22) * ar - sway, uAim.y * 0.2);
  float haze = 0.7 + 0.3 * noise(uv * 3.0 + vec2(uTime * 0.05, uTime * 0.02));
  float b = beam(uv, l, tl, 0.2) * uIgnite.x + beam(uv, r, tr, 0.2) * uIgnite.y;
  b *= 0.92 + 0.08 * sin(uTime * 0.6);
  vec3 warm = vec3(1.0, 0.957, 0.839);
  vec3 cool = vec3(0.81, 0.89, 1.0);
  vec3 col = mix(cool, warm, clamp(uv.y, 0.0, 1.0)) * b * haze * uIntensity;
  col += warm * (exp(-length(uv - l) * 9.0) * uIgnite.x + exp(-length(uv - r) * 9.0) * uIgnite.y) * 0.7 * uIntensity;
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) / 255.0; // tramage : pas de bandes dans les dégradés
  o = vec4(col, clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0)); // alpha prémultiplié
}`;

/** Allumage d'un projecteur, comme l'animation CSS « floodlight » : il clignote puis s'éclaire. */
function ignition(t: number): number {
  if (t < 0) return 0;
  const steps: [number, number][] = [
    [0.4, 1],
    [0.24, 0.3],
    [0.2, 0.9],
    [0.12, 0.1],
    [0.08, 0.8],
  ];
  for (const [at, v] of steps) if (t >= at * 1.2) return v;
  return 0;
}

const FPS = 30;

export default function Floodlights({ intensity = 1, follow = false, className = "" }: { intensity?: number; follow?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas?.getContext("webgl2", { antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
    if (!canvas || !gl) return;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const uRes = u("uRes"),
      uTime = u("uTime"),
      uIgnite = u("uIgnite"),
      uAim = u("uAim"),
      uIntensity = u("uIntensity");
    gl.uniform1f(uIntensity, intensity);

    // Faisceaux flous : une demi-résolution suffit (DPR plafonné à 1,5), soit 4 à 9 fois moins de pixels à calculer.
    const resize = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.5;
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const aim = { x: 0, y: 0, tx: 0, ty: 0 };
    const onPointer = (e: PointerEvent) => {
      aim.tx = (e.clientX / window.innerWidth) * 2 - 1;
      aim.ty = 1 - (e.clientY / window.innerHeight) * 2;
    };
    if (follow) window.addEventListener("pointermove", onPointer, { passive: true });

    let raf = 0;
    let visible = true;
    let last = 0;
    let shown = false;
    const start = performance.now();
    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.visibilityState !== "visible") return;
      raf = requestAnimationFrame(frame);
      if (now - last < 1000 / FPS - 2) return;
      last = now;
      const t = (now - start) / 1000;
      // Inertie : la lumière rejoint le pointeur sans à-coups.
      aim.x += (aim.tx - aim.x) * 0.06;
      aim.y += (aim.ty - aim.y) * 0.06;
      gl.uniform1f(uTime, t);
      gl.uniform2f(uIgnite, ignition(t), ignition(t - 0.25));
      gl.uniform2f(uAim, aim.x, aim.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!shown) {
        shown = true;
        canvas.style.opacity = "1";
      }
    };
    const resume = () => {
      if (!raf && visible && document.visibilityState === "visible") raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      resume();
    });
    io.observe(canvas);
    document.addEventListener("visibilitychange", resume);
    const lost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(raf);
      raf = 0;
      canvas.style.opacity = "0";
    };
    canvas.addEventListener("webglcontextlost", lost);
    resume();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pointermove", onPointer);
      canvas.removeEventListener("webglcontextlost", lost);
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
    };
  }, [intensity, follow]);

  return <canvas ref={ref} aria-hidden className={`pointer-events-none absolute inset-0 h-full w-full opacity-0 transition-opacity duration-700 ${className}`} />;
}
