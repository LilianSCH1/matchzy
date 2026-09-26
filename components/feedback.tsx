"use client";

// Retours utilisateur partagés : confirmations (à la place de confirm()), notifications (à la place de alert())
// et bouton de formulaire avec état « en cours ».
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { IconAlert, IconCheck, IconX } from "./Icons";

// ------------------------------------------------------------------ Notifications

type Tone = "ok" | "error" | "info";
interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Affiche une notification éphémère, visible même après une navigation. */
export function toast(message: string, tone: Tone = "ok") {
  const id = nextId++;
  toasts = [...toasts, { id, message, tone }].slice(-3);
  emit();
  setTimeout(() => dismiss(id), tone === "error" ? 8000 : 4000);
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

const EMPTY: Toast[] = [];

export function Toaster() {
  const list = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => toasts,
    () => EMPTY,
  );
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite" role="status">
      {list.map((t) => (
        <div
          key={t.id}
          className={`rise pointer-events-auto flex max-w-md items-center gap-2.5 rounded-full py-2 pr-2 pl-4 text-sm font-medium shadow-[0_8px_30px_rgb(0_0_0/0.18)] ${
            t.tone === "error" ? "bg-danger text-white" : "bg-ink text-canvas"
          }`}
        >
          {t.tone === "error" ? <IconAlert className="size-4 shrink-0" /> : t.tone === "ok" ? <IconCheck className="size-4 shrink-0 text-accent" /> : null}
          <span className="min-w-0">{t.message}</span>
          <button className="grid size-7 shrink-0 place-items-center rounded-full opacity-60 hover:opacity-100" onClick={() => dismiss(t.id)} aria-label="Fermer">
            <IconX className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Confirmations

export interface ConfirmOptions {
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "default";
  /** Texte à retaper pour débloquer le bouton (actions irréversibles de grande ampleur). */
  requireText?: string;
  /** Travail à effectuer : la boîte reste ouverte pendant l'exécution et affiche l'erreur éventuelle. */
  action?: () => Promise<string | null | void>;
}

/**
 * Boîte de confirmation asynchrone.
 * const [dialog, ask] = useConfirm(); … if (await ask({ title: "…" })) …; puis rendre {dialog}.
 */
export function useConfirm(): [React.ReactNode, (o: ConfirmOptions) => Promise<boolean>] {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const ask = (o: ConfirmOptions) =>
    new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setOpts(o);
    });
  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  };
  return [opts ? <ConfirmDialog key={opts.title} {...opts} onClose={close} /> : null, ask];
}

function ConfirmDialog({ title, body, confirmLabel = "Confirmer", tone = "default", requireText, action, onClose }: ConfirmOptions & { onClose: (v: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const locked = !!requireText && typed.trim().toUpperCase() !== requireText.toUpperCase();
  const confirm = async () => {
    if (locked || pending) return;
    if (!action) return onClose(true);
    setPending(true);
    setError(null);
    try {
      const err = await action();
      if (err) {
        setError(err);
        setPending(false);
      } else onClose(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inattendue.");
      setPending(false);
    }
  };

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) onClose(false);
      }}
      onClick={(e) => e.target === ref.current && !pending && onClose(false)}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <form
        method="dialog"
        className="space-y-4 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          confirm();
        }}
      >
        {tone === "danger" && (
          <span className="grid size-11 place-items-center rounded-2xl bg-danger-soft text-danger">
            <IconAlert className="size-5" />
          </span>
        )}
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {body && <div className="text-sm leading-relaxed text-ink-2">{body}</div>}
        </div>
        {requireText && (
          <label className="block">
            <span className="label">
              Tapez <span className="font-mono font-semibold text-ink">{requireText}</span> pour confirmer
            </span>
            <input className="input font-mono" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus autoComplete="off" spellCheck={false} disabled={pending} />
          </label>
        )}
        {error && <p className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">{error}</p>}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <button type="button" className="btn-ghost" disabled={pending} onClick={() => onClose(false)} autoFocus={!requireText}>
            Annuler
          </button>
          <button type="submit" className={tone === "danger" ? "btn-danger" : "btn-primary"} disabled={locked || pending}>
            {pending && <Spinner />}
            {pending ? "Un instant…" : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}

// ------------------------------------------------------------------ Boutons « en cours »

export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`animate-spin ${className}`} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Bouton d'envoi d'un formulaire serveur : désactivé et animé pendant l'envoi. */
export function SubmitButton({ children, pendingLabel, className, title }: { children: React.ReactNode; pendingLabel?: string; className?: string; title?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending} aria-busy={pending} title={title}>
      {pending ? (
        <>
          <Spinner />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}
