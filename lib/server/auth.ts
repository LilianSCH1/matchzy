import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const ORG_COOKIE = "mz_org";
const refCookie = (tournamentId: string) => `mz_ref_${tournamentId.replace(/-/g, "")}`;
const DAY = 24 * 3600;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET manquant (voir .env.example).");
  return s;
}

function sign(payload: string): string {
  const mac = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${mac}`;
}

function verify(token: string | undefined): string | null {
  if (!token) return null;
  const [p, mac] = token.split(".");
  if (!p || !mac) return null;
  const payload = Buffer.from(p, "base64url").toString();
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const parts = payload.split("|");
  if (Number(parts.at(-1)) < Date.now() / 1000) return null;
  return parts.slice(0, -1).join("|");
}

function safeEqual(a: string, b: string): boolean {
  const x = createHmac("sha256", "cmp").update(a).digest();
  const y = createHmac("sha256", "cmp").update(b).digest();
  return timingSafeEqual(x, y);
}

const cookieOpts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 2 * DAY };

export async function loginOrganizer(password: string): Promise<boolean> {
  const expected = process.env.ORGANIZER_PASSWORD;
  if (!expected || !safeEqual(password, expected)) return false;
  (await cookies()).set(ORG_COOKIE, sign(`org|${Math.floor(Date.now() / 1000) + 2 * DAY}`), cookieOpts);
  return true;
}

export async function logout() {
  const store = await cookies();
  for (const c of store.getAll()) if (c.name === ORG_COOKIE || c.name.startsWith("mz_ref_")) store.delete(c.name);
}

export async function isOrganizer(): Promise<boolean> {
  return verify((await cookies()).get(ORG_COOKIE)?.value) === "org";
}

export async function setReferee(tournamentId: string, courtId: string) {
  (await cookies()).set(refCookie(tournamentId), sign(`ref|${courtId}|${Math.floor(Date.now() / 1000) + DAY}`), cookieOpts);
}

/** Terrain de l'arbitre connecté pour ce tournoi, ou null. */
export async function refereeCourt(tournamentId: string): Promise<string | null> {
  const v = verify((await cookies()).get(refCookie(tournamentId))?.value);
  return v?.startsWith("ref|") ? v.slice(4) : null;
}

export async function clearReferee(tournamentId: string) {
  (await cookies()).delete(refCookie(tournamentId));
}
