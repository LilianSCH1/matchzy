import { notFound, redirect } from "next/navigation";
import { isOrganizer } from "./auth";
import { loadBundleBySlug } from "./data";

export async function bundleOr404(slug: string) {
  const b = await loadBundleBySlug(decodeURIComponent(slug));
  if (!b) notFound();
  return b;
}

export async function requireOrganizerPage(next: string) {
  if (!(await isOrganizer())) redirect(`/login?next=${encodeURIComponent(next)}`);
}
