import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CommandPalette } from "@/components/CommandPalette";
import { Toaster } from "@/components/feedback";
import { THEME_SCRIPT } from "@/components/ThemeToggle";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Matchzy — tournoi en direct",
  description: "Poules, matchs, scores, classements et phase finale le jour du tournoi.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f4f7" },
    { media: "(prefers-color-scheme: dark)", color: "#090b10" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
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
