import { unstable_cache } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { isOrganizer } from "./auth";
import { loadBundleBySlug } from "./data";

/**
 * Données d'un tournoi pour l'affichage, mises en cache : les pages en direct se rafraîchissent
 * toutes les 5 s chez chaque spectateur, sans solliciter la base à chaque fois.
 * Les Server Actions invalident l'étiquette `t:<slug>` à chaque écriture ; `revalidate` rattrape
 * les écritures faites hors de l'application (scripts).
 */
const cachedBundle = (slug: string) =>
  unstable_cache(() => loadBundleBySlug(slug), ["bundle", slug], { tags: [`t:${slug}`, "tournaments"], revalidate: 60 })();

export async function bundleOr404(slug: string) {
  const b = await cachedBundle(decodeURIComponent(slug));
  if (!b) notFound();
  return b;
}

export async function requireOrganizerPage(next: string) {
  if (!(await isOrganizer())) redirect(`/login?next=${encodeURIComponent(next)}`);
}
