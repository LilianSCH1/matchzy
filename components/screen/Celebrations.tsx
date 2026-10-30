"use client";

import { useEffect, useRef, useState } from "react";
import { CelebrationQueue, scoreGains, type ScoreState } from "@/lib/live";

export interface LiveScore extends ScoreState {
  court: string;
  homeName: string;
  awayName: string;
}

interface Goal {
  matchId: string;
  side: "home" | "away";
  text: string;
  scorer: string;
  at: number;
}

const EVENT = "matchzy:celebrate";
const GAP_MS = 4000;
const BANNER_MS = 3400;
const FX_MS = 800;
/** Un but plus ancien que ça n'est plus annoncé (écran resté caché, file trop longue). */
const STALE_MS = 15000;

/**
 * Chef d'orchestre des célébrations de l'écran géant. À chaque rafraîchissement du direct, compare les scores
 * des matchs en cours avec les précédents ; chaque hausse est mise en file (une célébration toutes les 4 s
 * par terrain), puis annoncée : flash sur le tableau du terrain, bandeau « BUT · … », corne si le son est activé.
 * `word` vaut null pour les sports où l'on marque sans cesse (basket, rugby) : flash seulement, sans bandeau.
 */
export function CelebrationHost({ matches, word }: { matches: LiveScore[]; word: string | null }) {
  const prev = useRef<Map<string, ScoreState> | null>(null);
  const queue = useRef(new CelebrationQueue<Goal>(GAP_MS));
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const banners = useRef<Goal[]>([]);
  const [banner, setBanner] = useState<Goal | null>(null);
  const sig = matches.map((m) => `${m.id}:${m.live ? 1 : 0}:${m.home}:${m.away}`).join(",");

  useEffect(() => {
    const now = Date.now();
    for (const g of scoreGains(prev.current, matches)) {
      const m = matches.find((x) => x.id === g.matchId)!;
      // Score vu du marqueur : « ES Montagne — 4–1 face à Juniors Centre · Terrain 2 ».
      const home = g.side === "home";
      const [mine, theirs] = home ? [m.home ?? 0, m.away ?? 0] : [m.away ?? 0, m.home ?? 0];
      queue.current.push(m.court, {
        matchId: m.id,
        side: g.side,
        scorer: home ? m.homeName : m.awayName,
        at: now,
        text: `${mine}–${theirs} face à ${home ? m.awayName : m.homeName} · ${m.court}`,
      });
    }
    prev.current = new Map(matches.map((m) => [m.id, m]));

    const pump = () => {
      const t = Date.now();
      for (const goal of queue.current.take(t)) {
        if (t - goal.at > STALE_MS) continue;
        window.dispatchEvent(new CustomEvent(EVENT, { detail: { matchId: goal.matchId, side: goal.side } }));
        if (word && banners.current.length < 3) banners.current.push(goal);
      }
      setBanner((b) => b ?? banners.current.shift() ?? null);
      const wait = queue.current.nextIn(Date.now());
      if (wait !== null) timer.current = setTimeout(pump, wait + 20);
    };
    clearTimeout(timer.current);
    pump();
    // `matches` change à chaque rafraîchissement ; `sig` ne change que si un score ou un statut change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, word]);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Un bandeau à la fois : le suivant prend la place à la fin du précédent. La corne accompagne chaque annonce.
  useEffect(() => {
    if (!banner) return;
    void import("@/lib/client/fx").then(({ fx }) => fx.score());
    const id = setTimeout(() => setBanner(banners.current.shift() ?? null), BANNER_MS);
    return () => clearTimeout(id);
  }, [banner]);

  return (
    <div aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-16 z-20 overflow-hidden">
      {banner && word && (
        <div key={`${banner.matchId}-${banner.at}-${banner.side}`} className="lower-third board flex h-20 items-stretch shadow-[0_20px_60px_rgb(0_0_0/0.6)]">
          <span className="flex items-center bg-sport px-8 font-display text-[56px] leading-none font-black text-black uppercase">{word}</span>
          <span className="flex min-w-0 items-center gap-4 px-8 font-cond text-[34px] font-extrabold tracking-[0.03em] uppercase">
            <span className="shrink-0 text-led">{banner.scorer}</span>
            <span className="truncate text-[#b4afa3]">{banner.text}</span>
          </span>
        </div>
      )}
    </div>
  );
}

/** Tableau d'un terrain qui réagit aux célébrations de son match : flash du sport, score du marqueur qui gonfle. */
export function BoardFx({ matchId, children }: { matchId: string | null; children: React.ReactNode }) {
  const [fx, setFx] = useState<{ side: "home" | "away"; n: number } | null>(null);

  useEffect(() => {
    if (!matchId) return;
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ matchId: string; side: "home" | "away" }>).detail;
      if (d.matchId === matchId) setFx((f) => ({ side: d.side, n: (f?.n ?? 0) + 1 }));
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, [matchId]);

  useEffect(() => {
    if (!fx) return;
    const id = setTimeout(() => setFx(null), FX_MS);
    return () => clearTimeout(id);
  }, [fx]);

  return (
    <div className="celebrate h-full" data-fx={fx?.side}>
      {children}
    </div>
  );
}
