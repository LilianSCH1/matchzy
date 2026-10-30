"use client";

import { LazyMotion, MotionConfig } from "motion/react";

const loadAnimation = () => import("./features").then((f) => f.domAnimation);
const loadLayout = () => import("./features").then((f) => f.domMax);

/**
 * Îlot Motion : à placer au plus près des composants animés, jamais dans le layout racine.
 * Les fonctions de Motion arrivent dans un fichier séparé, après le premier rendu ; `layout` charge aussi
 * les mises en page partagées (réordonnancement des classements). `strict` impose `m.*` au lieu de `motion.*`.
 */
export function MotionIsland({ children, layout = false }: { children: React.ReactNode; layout?: boolean }) {
  return (
    <LazyMotion features={layout ? loadLayout : loadAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
