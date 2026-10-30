"use client";

import { useReportWebVitals } from "next/web-vitals";

/** Journal des Core Web Vitals dans la console (développement uniquement : rendu par le layout seulement hors production). */
export function WebVitals() {
  useReportWebVitals((m) => {
    const value = m.name === "CLS" ? m.value.toFixed(3) : `${Math.round(m.value)} ms`;
    console.log(`%c${m.name}%c ${value} · ${m.rating}`, "font-weight:700;color:#ff6b1a", "color:inherit");
  });
  return null;
}
