import { headers } from "next/headers";
import { db } from "./db";

/** Adresse IP du client (derrière Cloudflare et Nginx, ou un autre proxy). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("cf-connecting-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "inconnue";
}

export interface Limit {
  key: string;
  max: number;
  windowSec: number;
}

/**
 * Compte une tentative pour chaque clé et indique si l'une d'elles dépasse sa limite.
 * Renvoie le nombre de minutes à attendre, ou 0 si la tentative est autorisée.
 */
export async function hitLimits(limits: Limit[]): Promise<number> {
  const sql = db();
  const now = Math.floor(Date.now() / 1000);
  let wait = 0;
  for (const l of limits) {
    // Nouvelle fenêtre si la précédente est écoulée, sinon une tentative de plus.
    const [row] = await sql<{ count: number; window_start: number }[]>`
      insert into login_attempts (key, count, window_start) values (${l.key}, 1, ${now})
      on conflict (key) do update set
        count = case when login_attempts.window_start < ${now - l.windowSec} then 1 else login_attempts.count + 1 end,
        window_start = case when login_attempts.window_start < ${now - l.windowSec} then ${now} else login_attempts.window_start end
      returning count, window_start`;
    if (row.count > l.max) wait = Math.max(wait, Math.ceil((row.window_start + l.windowSec - now) / 60));
  }
  return wait;
}

/** Remet à zéro les compteurs (connexion réussie). */
export async function clearLimits(keys: string[]): Promise<void> {
  if (keys.length) await db()`delete from login_attempts where key in ${db()(keys)}`;
}
