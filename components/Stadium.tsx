// Habillage « stade » partagé : identité de chaque sport (couleur, pictogramme, lignes du terrain),
// chiffres du tableau d'affichage et bandeau défilant. Sans état : utilisable côté serveur comme client.

export type SportKey = "football" | "futsal" | "handball" | "basketball" | "volleyball" | "badminton" | "tennis-de-table" | "rugby" | "custom";

/** Rattache un nom de sport (préréglage ou saisi à la main) à un habillage connu. */
export function sportKey(name: string | null | undefined): SportKey {
  const n = (name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (n.includes("futsal")) return "futsal";
  if (n.includes("foot") || n.includes("soccer")) return "football";
  if (n.includes("hand")) return "handball";
  if (n.includes("basket")) return "basketball";
  if (n.includes("volley")) return "volleyball";
  if (n.includes("badminton")) return "badminton";
  if (n.includes("ping") || n.includes("tennis de table") || n.includes("table")) return "tennis-de-table";
  if (n.includes("rugby")) return "rugby";
  return "custom";
}

type P = { className?: string };

function G({ className = "size-4", children }: P & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {children}
    </svg>
  );
}

const GLYPHS: Record<SportKey, (p: P) => React.ReactNode> = {
  football: (p) => (
    <G {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="m12 8 3.2 2.3-1.2 3.7h-4l-1.2-3.7zM12 8V3.5M15.2 10.3l4.3-1.4M14 14l2.6 3.6M10 14l-2.6 3.6M8.8 10.3 4.5 8.9" />
    </G>
  ),
  futsal: (p) => GLYPHS.football(p),
  basketball: (p) => (
    <G {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3v18M5.6 5.6c3.2 3.4 3.2 9.4 0 12.8M18.4 5.6c-3.2 3.4-3.2 9.4 0 12.8" />
    </G>
  ),
  volleyball: (p) => (
    <G {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 12c0-4 2-7.5 5.5-8.2M12 12c-3.5 2-7.6 2-10-.6M12 12c3.4 2 5.4 5.6 4.6 9" />
    </G>
  ),
  handball: (p) => (
    <G {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M4 8.5c4.5 1.5 11.5 1.5 16 0M4 15.5c4.5-1.5 11.5-1.5 16 0M12 3c-2.5 5-2.5 13 0 18" />
    </G>
  ),
  badminton: (p) => (
    <G {...p}>
      <circle cx="12" cy="18.5" r="2.5" />
      <path d="M10 16.5 5.5 4.5h13L14 16.5M9 4.5l1.6 11.6M15 4.5l-1.6 11.6M7 9h10" />
    </G>
  ),
  "tennis-de-table": (p) => (
    <G {...p}>
      <circle cx="10" cy="10" r="6.5" />
      <path d="m14.6 14.6 5 5" strokeWidth={3} />
      <circle cx="19" cy="5" r="1.6" fill="currentColor" />
    </G>
  ),
  rugby: (p) => (
    <G {...p}>
      <ellipse cx="12" cy="12" rx="10" ry="5.5" transform="rotate(-35 12 12)" />
      <path d="M8.5 15.5 15.5 8.5M10 12.2l1.8 1.8M11.6 10.6l1.8 1.8M13.2 9l1.8 1.8" />
    </G>
  ),
  custom: (p) => (
    <G {...p}>
      <circle cx="9" cy="14" r="5" />
      <path d="M13 11.5 21 7V4h-9L8 9" />
    </G>
  ),
};

export function SportGlyph({ sport, className }: { sport: SportKey } & P) {
  return GLYPHS[sport]({ className });
}

/** Pastille du sport : pictogramme et nom, dans la couleur du sport. */
export function SportBadge({ name, className = "", vt }: { name: string; className?: string; /** Nom de transition de page (view-transition-name). */ vt?: string }) {
  const s = sportKey(name);
  return (
    <span data-sport={s} className={`chip border border-sport/45 bg-sport/12 text-ink ${className}`} style={vt ? { viewTransitionName: vt } : undefined}>
      <SportGlyph sport={s} className="size-3.5 text-sport" />
      {name}
    </span>
  );
}

/**
 * Lignes du terrain du sport, tracées à la craie (hérite de la couleur du texte).
 * Sert de décor aux bandeaux et aux cartes : un tournoi de basket n'a pas la même allure qu'un tournoi de foot.
 */
export function CourtLines({ sport, className = "" }: { sport: SportKey } & P) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.4, vectorEffect: "non-scaling-stroke" as const };
  const body = (() => {
    switch (sport) {
      case "football":
        return (
          <>
            <rect x="4" y="4" width="192" height="112" />
            <path d="M100 4v112M4 30h28v60H4M196 30h-28v60h28M4 46h10v28H4M196 46h-10v28h10M32 48a16 16 0 0 1 0 24M168 48a16 16 0 0 0 0 24" />
            <circle cx="100" cy="60" r="17" />
            <circle cx="100" cy="60" r="1.2" fill="currentColor" />
          </>
        );
      case "futsal":
        return (
          <>
            <rect x="4" y="4" width="192" height="112" />
            <path d="M100 4v112M4 34a26 26 0 0 1 26 26 26 26 0 0 1-26 26M196 34a26 26 0 0 0-26 26 26 26 0 0 0 26 26" />
            <circle cx="100" cy="60" r="15" />
          </>
        );
      case "handball":
        return (
          <>
            <rect x="4" y="4" width="192" height="112" />
            <path d="M100 4v112M4 26c22 0 30 12 30 34s-8 34-30 34M196 26c-22 0-30 12-30 34s8 34 30 34" />
            <path d="M4 14c32 0 42 18 42 46s-10 46-42 46M196 14c-32 0-42 18-42 46s10 46 42 46" strokeDasharray="5 4" />
          </>
        );
      case "basketball":
        return (
          <>
            <rect x="4" y="4" width="192" height="112" />
            <path d="M100 4v112M4 44h38v32H4M196 44h-38v32h38M4 12h16a50 50 0 0 1 0 96H4M196 12h-16a50 50 0 0 0 0 96h16" />
            <circle cx="42" cy="60" r="13" />
            <circle cx="158" cy="60" r="13" />
            <circle cx="100" cy="60" r="14" />
          </>
        );
      case "volleyball":
        return (
          <>
            <rect x="20" y="12" width="160" height="96" />
            <path d="M73 12v96M127 12v96" />
            <path d="M100 6v108" strokeWidth={3} />
          </>
        );
      case "badminton":
        return (
          <>
            <rect x="10" y="10" width="180" height="100" />
            <path d="M10 20h180M10 100h180M22 10v100M178 10v100M78 10v100M122 10v100M10 60h68M122 60h68" />
            <path d="M100 4v112" strokeWidth={3} />
          </>
        );
      case "tennis-de-table":
        return (
          <>
            <rect x="26" y="22" width="148" height="76" rx="2" />
            <path d="M26 60h148" />
            <path d="M100 14v92" strokeWidth={3} />
          </>
        );
      case "rugby":
        return (
          <>
            <rect x="4" y="8" width="192" height="104" />
            <path d="M22 8v104M178 8v104M52 8v104M148 8v104M100 8v104" />
            <path d="M82 8v104M118 8v104" strokeDasharray="6 5" />
            <path d="M22 52v-18M22 68v18M14 52h16" />
          </>
        );
      default:
        return (
          <>
            <rect x="6" y="6" width="188" height="108" rx="4" />
            <path d="M100 6v108" />
            <circle cx="100" cy="60" r="16" />
          </>
        );
    }
  })();
  return (
    <svg viewBox="0 0 200 120" preserveAspectRatio="xMidYMid meet" className={className} aria-hidden {...common}>
      {body}
    </svg>
  );
}

/** Chiffre du tableau des scores : net, aligné, sans effet. `null` affiche un tiret. */
export function Led({ value, className = "", color }: { value: string | number | null; digits?: number; className?: string; color?: string }) {
  const text = value === null || value === undefined ? "–" : String(value);
  return (
    <span className={`led inline-block leading-none ${className}`} style={color ? ({ "--led": color } as React.CSSProperties) : undefined}>
      {text}
    </span>
  );
}

/** Bandeau défilant (résultats) façon panneau LED de bord de terrain. */
export function Ticker({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`board ticker-pause flex h-9 items-center overflow-hidden ${className}`}>
      <span className="z-10 flex h-full shrink-0 items-center gap-2 bg-accent px-3 text-[13px] font-bold text-on-accent">
        <span className="live-dot size-1.5 rounded-full bg-current" />
        {label}
      </span>
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div className="ticker flex w-max items-center gap-10 pl-6 whitespace-nowrap">
          {children}
          {children}
        </div>
      </div>
    </div>
  );
}
