// Accès des participants et spectateurs : un tournoi se rejoint avec son identifiant (slug) et un code secret,
// tous deux communiqués par l'organisateur. Lecture seule : la saisie des scores reste réservée aux codes arbitres.

/** Lettres et chiffres sans ambiguïté à la lecture (pas de O/0, I/1/L). */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ACCESS_CODE_LENGTH = 6;

/** Code participant : 6 caractères tirés au hasard cryptographique (31⁶ ≈ 887 millions de combinaisons). */
export function newAccessCode(): string {
  const bytes = crypto.getRandomValues(new Uint32Array(ACCESS_CODE_LENGTH));
  return Array.from(bytes, (n) => ALPHABET[n % ALPHABET.length]).join("");
}

/** Met en forme un code saisi : majuscules, sans espaces ni tirets. */
export function normalizeAccessCode(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]/g, "");
}

export function isAccessCode(code: string): boolean {
  return code.length === ACCESS_CODE_LENGTH && [...code].every((c) => ALPHABET.includes(c));
}

/**
 * Identifiant du tournoi à partir de ce que tape le participant : le slug (« tournoi-volley-nancy »),
 * le nom avec majuscules et espaces, ou le lien complet partagé par l'organisateur.
 */
export function parseTournamentRef(raw: string): string {
  let s = raw.trim();
  const m = s.match(/\/t\/([^/?#\s]+)/);
  if (m) s = decodeURIComponent(m[1]);
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/** Tournoi enregistré sur l'appareil du participant (liste « Mes tournois »). */
export interface SavedTournament {
  slug: string;
  code: string;
  name: string;
  sport: string;
  date: string;
  addedAt: number;
}

/** Résumé renvoyé par le serveur pour un tournoi de la liste (code vérifié). */
export interface ParticipantSummary {
  slug: string;
  found: boolean;
  name?: string;
  sport?: string;
  date?: string;
  live?: number;
  done?: number;
  total?: number;
}
