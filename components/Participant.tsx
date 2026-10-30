"use client";

// Espace participant / spectateur : on rejoint un tournoi avec son nom et son code, la liste est gardée
// sur l'appareil (localStorage) comme une collection de billets. Lecture seule : pas de saisie de score ici.
import { usePathname, useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { joinTournamentAction, leaveTournamentAction, myTournamentsAction, type JoinResult } from "@/app/actions";
import { ACCESS_CODE_LENGTH, type ParticipantSummary, type SavedTournament } from "@/lib/access";
import { Spinner, toast, useConfirm } from "./feedback";
import { IconTicket, IconTrash } from "./Icons";
import { TournamentCard } from "./TournamentCard";
import { Empty } from "./TopBar";
import { ErrorText } from "./ui";

// ------------------------------------------------------------------ Liste mémorisée sur l'appareil

const KEY = "matchzy:mes-tournois";
const EVENT = "matchzy:mes-tournois";
const NONE: SavedTournament[] = [];
let cache: { raw: string | null; list: SavedTournament[] } = { raw: null, list: NONE };

function read(): SavedTournament[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {}
  if (raw === cache.raw) return cache.list;
  let list: SavedTournament[] = NONE;
  try {
    const v = raw ? JSON.parse(raw) : [];
    if (Array.isArray(v)) list = v.filter((x) => x && typeof x.slug === "string" && typeof x.code === "string");
  } catch {}
  cache = { raw, list };
  return list;
}

function write(list: SavedTournament[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function saveTournament(entry: SavedTournament) {
  const rest = read().filter((t) => t.slug !== entry.slug);
  write([entry, ...rest]);
}

function forget(slug: string) {
  write(read().filter((t) => t.slug !== slug));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Tournois enregistrés sur cet appareil ; `null` avant la lecture (rendu serveur). */
export function useSavedTournaments(): SavedTournament[] | null {
  return useSyncExternalStore<SavedTournament[] | null>(subscribe, read, () => null);
}

// ------------------------------------------------------------------ Formulaire « Rejoindre »

export function JoinForm({ tournament = "", autoFocus = false }: { tournament?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const path = usePathname();
  // L'enregistrement se fait dès la réponse, avant le nouveau rendu : le cookie d'accès posé par l'action
  // fait réafficher la page du tournoi, et ce formulaire disparaît aussitôt (un effet n'aurait pas le temps de tourner).
  const [state, action, pending] = useActionState<JoinResult, FormData>(async (prev, form) => {
    const r = await joinTournamentAction(prev, form);
    const e = r.entry;
    if (e) {
      saveTournament(e);
      toast(`« ${e.name} » ajouté à vos tournois.`);
      if (path === `/t/${e.slug}`) router.refresh();
      else router.push(`/t/${e.slug}`);
    }
    return r;
  }, {});

  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label" htmlFor="join-tournament">
          Nom du tournoi
        </label>
        <input
          id="join-tournament"
          name="tournament"
          defaultValue={tournament}
          required
          autoFocus={autoFocus && !tournament}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="tournoi-volley-nancy"
          className="input text-[17px] font-semibold"
        />
      </div>
      <div>
        <label className="label" htmlFor="join-code">
          Code participant
        </label>
        <input
          id="join-code"
          name="code"
          required
          autoFocus={autoFocus && !!tournament}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={ACCESS_CODE_LENGTH + 2}
          placeholder="A7K2QX"
          className="input h-14 text-center font-mono text-[26px] font-semibold tracking-[0.2em] uppercase placeholder:tracking-[0.2em]"
        />
      </div>
      <ErrorText>{state.error}</ErrorText>
      <button className="btn-accent h-12 w-full" disabled={pending}>
        {pending ? <Spinner /> : <IconTicket className="size-5" />}
        {pending ? "Vérification…" : "Rejoindre le tournoi"}
      </button>
          </form>
  );
}

// ------------------------------------------------------------------ « Mes tournois »

export function MyTournaments() {
  const saved = useSavedTournaments();
  const [live, setLive] = useState<Map<string, ParticipantSummary>>(new Map());
  const [dialog, ask] = useConfirm();
  const key = saved?.map((s) => `${s.slug}:${s.code}`).join("|") ?? "";

  // État en direct de chaque tournoi (et renouvellement de l'accès), rafraîchi toutes les 30 s.
  useEffect(() => {
    if (!saved?.length) return;
    let stop = false;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await myTournamentsAction(saved.map(({ slug, code }) => ({ slug, code })));
        if (!stop) setLive(new Map(res.map((r) => [r.slug, r])));
      } catch {}
    };
    load();
    const id = setInterval(load, 30000);
    return () => {
      stop = true;
      clearInterval(id);
    };
    // `key` résume la liste : inutile de relancer si seul l'objet a changé.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (saved === null) return <div className="h-40 animate-pulse rounded-[10px] bg-surface-2" aria-hidden />;
  if (!saved.length)
    return (
      <Empty icon={<IconTicket className="size-5" />}>
        <p className="text-lg font-semibold text-ink">Aucun tournoi rejoint</p>
        <p className="mt-1">Une fois rejoint, un tournoi reste enregistré ici sur cet appareil.</p>
      </Empty>
    );

  const remove = async (t: SavedTournament) => {
    const ok = await ask({
      title: `Retirer « ${t.name} » ?`,
      body: "Le tournoi disparaît de votre liste sur cet appareil. Pour le revoir, il faudra saisir à nouveau son code.",
      confirmLabel: "Retirer de ma liste",
      tone: "danger",
    });
    if (!ok) return;
    forget(t.slug);
    leaveTournamentAction(t.slug).catch(() => {});
    toast(`« ${t.name} » retiré de vos tournois.`, "info");
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {saved.map((t) => {
          const s = live.get(t.slug);
          if (s && !s.found)
            return (
              <div key={t.slug} className="card flex flex-col gap-3 border-dashed p-4">
                <div className="display text-[19px] text-ink-3 line-through">{t.name}</div>
                <p className="text-sm text-ink-3">Ce tournoi a été supprimé ou son code a changé.</p>
                <button className="btn-ghost h-9 self-start text-[13px]" onClick={() => remove(t)}>
                  <IconTrash className="size-4" /> Retirer
                </button>
              </div>
            );
          return (
            <TournamentCard
              key={t.slug}
              slug={t.slug}
              name={s?.name ?? t.name}
              sport={s?.sport ?? t.sport}
              date={s?.date ?? t.date}
              live={s?.live}
              done={s?.done}
              total={s?.total}
              footer={
                <>
                  <span className="px-2 text-[12px] font-bold text-ink-3">
                    Code <span className="text-[14px] text-ink-2">{t.code}</span>
                  </span>
                  <button
                    className="btn-icon relative z-10 ml-auto hover:bg-danger-soft hover:text-danger"
                    onClick={() => remove(t)}
                    aria-label={`Retirer ${t.name} de ma liste`}
                    title="Retirer de ma liste"
                  >
                    <IconTrash className="size-4" />
                  </button>
                </>
              }
            />
          );
        })}
      </div>
      {dialog}
    </>
  );
}

// ------------------------------------------------------------------ Contrôle d'accès d'un tournoi

/**
 * Affiché à la place du tournoi quand l'appareil n'y a pas encore accès. Si le code est déjà
 * enregistré sur l'appareil (accès expiré, cookies effacés), l'entrée se refait toute seule.
 */
export function JoinGate({ slug }: { slug: string }) {
  const router = useRouter();
  const saved = useSavedTournaments();
  const entry = saved?.find((t) => t.slug === slug);
  const tried = useRef(false);
  const [auto, setAuto] = useState<"idle" | "trying" | "failed">("idle");

  useEffect(() => {
    if (!entry || tried.current) return;
    tried.current = true;
    setAuto("trying");
    const fd = new FormData();
    fd.set("tournament", entry.slug);
    fd.set("code", entry.code);
    joinTournamentAction({}, fd)
      .then((r) => {
        if (r.entry) {
          saveTournament({ ...entry, ...r.entry, addedAt: entry.addedAt });
          router.refresh();
        } else setAuto("failed");
      })
      .catch(() => setAuto("failed"));
  }, [entry, router]);

  if (saved === null || auto === "trying")
    return (
      <div className="flex items-center justify-center gap-3 py-16 text-[15px] font-bold text-ink-3">
        <Spinner /> Vérification de l&apos;accès…
      </div>
    );

  return (
    <div className="card mx-auto max-w-sm p-5">
      {auto === "failed" && <p className="mb-3 text-sm text-ink-2">Le code enregistré sur cet appareil n&apos;est plus valable. Demandez le nouveau code à l&apos;organisateur.</p>}
      <JoinForm tournament={slug} autoFocus />
    </div>
  );
}
