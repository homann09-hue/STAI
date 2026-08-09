"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  MIN_PASSWORD_LENGTH,
  describeAuthError,
  safeRedirectTarget,
  validateEmail,
  validatePassword,
  validateRegistration,
  type CredentialIssue
} from "@/lib/auth/credentials";

/**
 * Registrierung, Anmeldung und Passwort-Zurücksetzen in einer Komponente.
 *
 * Bewusst eine statt drei fast gleicher: die Unterschiede sind ein Feld und ein
 * Aufruf. Drei Kopien hätten sich auseinanderentwickelt, und die Stelle, an der
 * das am teuersten wäre, ist die Fehlerbehandlung.
 */

type Mode = "register" | "login" | "forgot" | "reset";

const copy: Record<Mode, { title: string; intro: string; submit: string }> = {
  register: {
    title: "Konto erstellen",
    intro: "Kostenlos. Sie können StockPilot damit ausprobieren, bevor Sie sich für einen Tarif entscheiden.",
    submit: "Konto erstellen"
  },
  login: {
    title: "Anmelden",
    intro: "Willkommen zurück.",
    submit: "Anmelden"
  },
  forgot: {
    title: "Passwort zurücksetzen",
    intro: "Wir schicken Ihnen einen Link, mit dem Sie ein neues Passwort setzen können.",
    submit: "Link anfordern"
  },
  reset: {
    title: "Neues Passwort setzen",
    intro: "Wählen Sie ein neues Passwort für Ihr Konto.",
    submit: "Passwort speichern"
  }
};

function issueFor(issues: CredentialIssue[], field: CredentialIssue["field"]) {
  return issues.find((issue) => issue.field === field)?.message ?? null;
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeRedirectTarget(params.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [issues, setIssues] = useState<CredentialIssue[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setDone(null);

    const found =
      mode === "register"
        ? validateRegistration(email, password, confirm)
        : mode === "forgot"
          ? [validateEmail(email)].filter((entry): entry is CredentialIssue => entry !== null)
          : mode === "reset"
            ? [validatePassword(password)].filter((entry): entry is CredentialIssue => entry !== null)
            : [validateEmail(email)].filter((entry): entry is CredentialIssue => entry !== null);

    setIssues(found);
    if (found.length) return;

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      // Ehrlich benannt: das ist ein Betriebsfehler, kein Eingabefehler.
      setFormError("Die Anmeldung ist gerade nicht eingerichtet. Bitte versuchen Sie es später erneut.");
      return;
    }

    setBusy(true);

    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/login` }
        });

        // Auch bei `user_already_registered` derselbe Satz. Andernfalls waere
        // das Formular eine Kontoauskunft: durchprobieren verriete, welche
        // Adressen registriert sind.
        if (error && error.code !== "user_already_registered") {
          setFormError(describeAuthError(error.code, error.message));
          return;
        }

        setDone("Fast fertig: Bitte bestätigen Sie den Link, den wir Ihnen geschickt haben.");
        return;
      }

      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`
        });

        if (error) {
          setFormError(describeAuthError(error.code, error.message));
          return;
        }

        // Auch wenn es die Adresse nicht gibt -- sonst wieder Kontoauskunft.
        setDone("Wenn es zu dieser Adresse ein Konto gibt, ist der Link unterwegs.");
        return;
      }

      if (mode === "reset") {
        const { error } = await supabase.auth.updateUser({ password });

        if (error) {
          setFormError(describeAuthError(error.code, error.message));
          return;
        }

        setDone("Passwort gespeichert. Sie können sich jetzt anmelden.");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

      if (error) {
        setFormError(describeAuthError(error.code, error.message));
        return;
      }

      router.push(next);
      router.refresh();
    } catch {
      setFormError("Die Anfrage ist nicht durchgelaufen. Bitte versuchen Sie es erneut.");
    } finally {
      setBusy(false);
    }
  }

  const text = copy[mode];
  const showEmail = mode !== "reset";
  const showPassword = mode !== "forgot";

  return (
    <section className="mx-auto w-full max-w-md">
      <h1 className="text-2xl font-semibold text-mist">{text.title}</h1>
      <p className="mt-2 text-sm leading-6 text-muted">{text.intro}</p>

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        {showEmail ? (
          <label className="block text-sm text-muted">
            E-Mail-Adresse
            <input
              type="email"
              value={email}
              autoComplete="email"
              maxLength={254}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-stroke bg-coal px-3 text-mist outline-none focus:border-cyan"
            />
            {issueFor(issues, "email") ? (
              <span className="mt-1 block text-xs text-loss">{issueFor(issues, "email")}</span>
            ) : null}
          </label>
        ) : null}

        {showPassword ? (
          <label className="block text-sm text-muted">
            Passwort
            <input
              type="password"
              value={password}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              maxLength={200}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-stroke bg-coal px-3 text-mist outline-none focus:border-cyan"
            />
            {issueFor(issues, "password") ? (
              <span className="mt-1 block text-xs text-loss">{issueFor(issues, "password")}</span>
            ) : mode !== "login" ? (
              <span className="mt-1 block text-xs text-muted">
                Mindestens {MIN_PASSWORD_LENGTH} Zeichen. Eine Wortfolge ist sicherer als ein kurzes Kunstwort.
              </span>
            ) : null}
          </label>
        ) : null}

        {mode === "register" ? (
          <label className="block text-sm text-muted">
            Passwort wiederholen
            <input
              type="password"
              value={confirm}
              autoComplete="new-password"
              maxLength={200}
              onChange={(event) => setConfirm(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-stroke bg-coal px-3 text-mist outline-none focus:border-cyan"
            />
            {issueFor(issues, "confirm") ? (
              <span className="mt-1 block text-xs text-loss">{issueFor(issues, "confirm")}</span>
            ) : null}
          </label>
        ) : null}

        {formError ? (
          <p className="flex gap-2 rounded-xl border border-loss/25 bg-loss/10 p-3 text-sm text-loss">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{formError}</span>
          </p>
        ) : null}

        {done ? (
          <p className="flex gap-2 rounded-xl border border-profit/25 bg-profit/10 p-3 text-sm text-profit">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{done}</span>
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan font-semibold text-ink disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {text.submit}
        </button>
      </form>

      <div className="mt-6 space-y-2 text-sm text-muted">
        {mode === "login" ? (
          <>
            <p>
              Noch kein Konto? <Link href="/register" className="text-cyan hover:underline">Kostenlos registrieren</Link>
            </p>
            <p>
              <Link href="/forgot-password" className="text-cyan hover:underline">Passwort vergessen?</Link>
            </p>
          </>
        ) : null}
        {mode === "register" ? (
          <p>
            Schon ein Konto? <Link href="/login" className="text-cyan hover:underline">Anmelden</Link>
          </p>
        ) : null}
        {mode === "forgot" || mode === "reset" ? (
          <p>
            <Link href="/login" className="text-cyan hover:underline">Zurück zur Anmeldung</Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}
