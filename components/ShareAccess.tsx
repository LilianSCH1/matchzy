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
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <IconTicket className="size-5 text-accent-ink" />
        <span className="display text-[17px]">Inviter les joueurs et le public</span>
      </div>
      <div className={`grid gap-4 p-4 ${compact ? "" : "sm:grid-cols-2"}`}>
        <button type="button" onClick={() => copy("Nom du tournoi", slug)} className="group text-left" title="Copier le nom du tournoi">
          <div className="text-[13px] font-semibold text-ink-3">Nom du tournoi</div>
          <div className="mt-1 flex items-center gap-2 text-[17px] font-semibold break-all text-ink group-hover:text-accent-ink">
            {slug}
            {copied === "Nom du tournoi" && <IconCheck className="size-4 shrink-0 text-ok" />}
          </div>
        </button>
        <button type="button" onClick={() => copy("Code participant", code)} className="group text-left" title="Copier le code">
          <div className="text-[13px] font-semibold text-ink-3">Code</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-mono text-[26px] leading-none font-bold tracking-[0.15em]">{code}</span>
            {copied === "Code participant" && <IconCheck className="size-4 text-ok" />}
          </div>
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5">
        <p className="min-w-0 flex-1 text-[13px] text-ink-2">Avec ce nom et ce code, chacun suit le tournoi en direct, sans pouvoir modifier les scores.</p>
        <button type="button" className="btn-accent h-9 px-3 text-[14px]" onClick={() => copy("Message", message)}>
          Copier le message
        </button>
      </div>
    </div>
  );
}
