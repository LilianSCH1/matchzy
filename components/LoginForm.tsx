"use client";

import { useActionState } from "react";
import { loginAction, refereeLoginAction } from "@/app/actions";
import { IconArrowRight } from "./Icons";
import { ErrorText } from "./ui";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="password">
          Mot de passe
        </label>
        <input id="password" name="password" type="password" autoFocus required className="input h-12" autoComplete="current-password" />
      </div>
      <ErrorText>{state?.error}</ErrorText>
      <button className="btn-primary h-12 w-full" disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"}
        {!pending && <IconArrowRight className="size-4" />}
      </button>
    </form>
  );
}

export function RefereeLoginForm({ slug, courtLabel }: { slug: string; courtLabel: string }) {
  const [state, action, pending] = useActionState(refereeLoginAction, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <div>
        <label className="label text-center" htmlFor="code">
          Code de votre {courtLabel}
        </label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          autoFocus
          required
          placeholder="••••••"
          className="input h-20 rounded-2xl text-center font-mono text-4xl font-medium tracking-[0.4em] placeholder:tracking-[0.4em]"
          maxLength={8}
        />
      </div>
      <ErrorText>{state?.error}</ErrorText>
      <button className="btn-primary h-14 w-full text-base" disabled={pending}>
        {pending ? "Vérification…" : "Accéder à mes matchs"}
        {!pending && <IconArrowRight className="size-4" />}
      </button>
    </form>
  );
}
