import type { Format, Sport } from "@/lib/types";

export const FORMAT_HINT: Record<Format, string> = {
  pools: "Chacun rencontre toutes les équipes de sa poule. Un classement par poule.",
  pools_knockout: "Des poules, puis un tableau final avec les meilleurs. Le plus classique.",
  knockout: "Tableau direct : un match perdu et c'est fini. Le plus rapide.",
};
export const FORMATS: Format[] = ["pools_knockout", "pools", "knockout"];

export function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const suggestName = (s?: Sport) => (!s || s.name === "Personnalisé" ? "Mon tournoi" : `Tournoi de ${s.name.toLowerCase()}`);
export const hhmm = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
export const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function swap<T>(arr: T[], i: number, j: number): T[] {
  const a = [...arr];
  [a[i], a[j]] = [a[j], a[i]];
  return a;
}
