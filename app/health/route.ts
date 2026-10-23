// Sonde de vie pour le déploiement (deploy/deploy.sh) : répond sans toucher à la base.
export const dynamic = "force-dynamic";

export function GET() {
  return new Response("ok", { headers: { "Cache-Control": "no-store" } });
}
