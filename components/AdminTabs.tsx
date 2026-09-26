"use client";

import { usePathname } from "next/navigation";
import { IconCalendar, IconGrid, IconSettings, IconUsers } from "./Icons";
import { TabBar } from "./TopBar";

export function AdminTabs({ base }: { base: string }) {
  const path = usePathname();
  const ic = "size-4";
  const items = [
    { key: base, href: base, label: "Tableau de bord", icon: <IconGrid className={ic} /> },
    { key: `${base}/planning`, href: `${base}/planning`, label: "Planning", icon: <IconCalendar className={ic} /> },
    { key: `${base}/equipes`, href: `${base}/equipes`, label: "Équipes", icon: <IconUsers className={ic} /> },
    { key: `${base}/regles`, href: `${base}/regles`, label: "Règles & accès", icon: <IconSettings className={ic} /> },
  ];
  return <TabBar items={items} active={path} />;
}
