"use client";

// Carte « Accès participants » de l'organisateur : le nom du tournoi et le code à communiquer
// (affichage à l'entrée, message aux équipes…), avec copie en un geste.
import { useEffect, useState } from "react";
import { toast } from "./feedback";
import { IconCheck, IconTicket } from "./Icons";

export function ShareAccess({ slug, code, compact = false }: { slug: string; code: string | null; compact?: boolean }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const link = `${origin}/t/${slug}`;
  const message = `Suivez le tournoi en direct sur ${link}\nNom du tournoi : ${slug}\nCode participant : ${code}`;

  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      toast(`${what} copié.`);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast("Copie impossible : sélectionnez le texte à la main.", "error");
    }
  };

  if (!code) return null;
  return (
    <div className="board overflow-hidden rounded-[10px]">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
        <IconTicket className="size-5 text-led" />
        <span className="display text-[20px] text-[#f3efe4]">Accès participants</span>
        <span className="ml-auto font-cond text-[11px] font-bold tracking-[0.12em] text-[#858074] uppercase">Lecture seule</span>
      </div>
      <div className={`grid gap-4 p-4 ${compact ? "" : "sm:grid-cols-2"}`}>
        <button type="button" onClick={() => copy("Nom du tournoi", slug)} className="group text-left" title="Copier le nom du tournoi">
          <div className="font-cond text-[11px] font-bold tracking-[0.14em] text-[#858074] uppercase">Nom du tournoi</div>
          <div className="mt-1 flex items-center gap-2 font-cond text-[20px] font-bold break-all text-[#f3efe4] group-hover:text-[#ff9b5e]">
            {slug}
            {copied === "Nom du tournoi" && <IconCheck className="size-4 shrink-0 text-[#3ddc84]" />}
          </div>
        </button>
        <button type="button" onClick={() => copy("Code participant", code)} className="group text-left" title="Copier le code">
          <div className="font-cond text-[11px] font-bold tracking-[0.14em] text-[#858074] uppercase">Code participant</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="led text-[34px] leading-none tracking-[0.18em]">{code}</span>
            {copied === "Code participant" && <IconCheck className="size-4 text-[#3ddc84]" />}
          </div>
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-4 py-2.5">
        <p className="min-w-0 flex-1 text-[13px] text-[#b4afa3]">À communiquer aux équipes et au public. Les scores restent saisis par les arbitres, avec leur propre code.</p>
        <button type="button" className="btn h-9 bg-[#ff6b1a] px-3 text-[13px] text-[#160800] shadow-[inset_0_-3px_0_rgb(0_0_0/0.28)] hover:bg-[#ff8644]" onClick={() => copy("Message", message)}>
          Copier le message
        </button>
      </div>
    </div>
  );
}
