import type { NextConfig } from "next";

const securityHeaders = [
  // Empêche l'intégration de l'application dans un site tiers (détournement de clics sur les boutons de score)
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Serveur autonome (server.js + dépendances utiles) : compilé hors du VPS, qui n'a pas la mémoire pour un build.
  output: "standalone",
  poweredByHeader: false,
  // Chaque déploiement ajoute « ?dpl=<commit> » aux fichiers de /_next/static : une réponse mise en cache
  // par Cloudflare pour une version (une 502 pendant un redémarrage, par exemple) ne sert plus à la suivante.
  deploymentId: process.env.GITHUB_SHA?.slice(0, 12),
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
