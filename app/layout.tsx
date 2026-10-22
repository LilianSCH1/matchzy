import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, Big_Shoulders, Doto, Permanent_Marker } from "next/font/google";
import { CommandPalette } from "@/components/CommandPalette";
import { Toaster } from "@/components/feedback";
import { THEME_SCRIPT } from "@/components/ThemeToggle";
import "./globals.css";

// Barlow pour la lecture, Barlow Condensed pour les libellés, Big Shoulders pour les affiches,
// Doto (matrice de points) pour le tableau d'affichage, Permanent Marker pour les annotations au feutre.
const sans = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-barlow", display: "swap" });
const cond = Barlow_Condensed({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-barlow-cond", display: "swap" });
const shoulders = Big_Shoulders({ subsets: ["latin"], weight: ["700", "800", "900"], variable: "--font-shoulders", display: "swap" });
const doto = Doto({ subsets: ["latin"], weight: ["700", "800", "900"], variable: "--font-doto", display: "swap" });
const hand = Permanent_Marker({ subsets: ["latin"], weight: "400", variable: "--font-pm", display: "swap" });

export const metadata: Metadata = {
  title: "Matchzy — tournoi en direct",
  description: "Poules, matchs, scores, classements et phase finale le jour du tournoi, pour tous les sports.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ece6d6" },
    { media: "(prefers-color-scheme: dark)", color: "#07090b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${sans.variable} ${cond.variable} ${shoulders.variable} ${doto.variable} ${hand.variable}`} suppressHydrationWarning>
      <head>
        {/* Applique le thème choisi avant le premier rendu (évite le flash clair → sombre). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh font-sans antialiased">
        {children}
        <CommandPalette />
        <Toaster />
      </body>
    </html>
  );
}
