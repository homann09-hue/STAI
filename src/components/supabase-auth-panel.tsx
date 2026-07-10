"use client";

import type { Session } from "@supabase/supabase-js";
import { CheckCircle2, LogOut, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const MAX_AUTH_EMAIL_LENGTH = 254;

function normalizeAuthEmail(value: string) {
  return value.trim().toLowerCase().slice(0, MAX_AUTH_EMAIL_LENGTH);
}

function isValidAuthEmail(value: string) {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(value);
}

function safeDisplayEmail(value: string | null | undefined) {
  const normalized = normalizeAuthEmail(value ?? "");
  return isValidAuthEmail(normalized) ? normalized : "angemeldeter Nutzer";
}

export function SupabaseAuthPanel() {
  const supabase = createSupabaseBrowserClient();
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(supabase ? "" : "Supabase ENV fehlt. Login ist lokal deaktiviert.");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    let disposed = false;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!disposed) setSession(data.session ?? null);
      })
      .catch(() => {
        if (!disposed) setSession(null);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!disposed) setSession(nextSession);
    });

    return () => {
      disposed = true;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  async function signIn() {
    const normalizedEmail = normalizeAuthEmail(email);

    if (!supabase || !normalizedEmail) return;

    if (!isValidAuthEmail(normalizedEmail)) {
      setMessage("Bitte eine gültige E-Mail-Adresse eingeben.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/settings`
        }
      });

      setMessage(error ? "Magic Link konnte nicht gesendet werden. Bitte E-Mail und Supabase-Konfiguration prüfen." : "Magic Link wurde gesendet. Bitte E-Mail prüfen.");
    } catch {
      setMessage("Magic Link konnte nicht gesendet werden. Bitte Verbindung und Supabase-Konfiguration prüfen.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;

    setBusy(true);
    try {
      const { error } = await supabase.auth.signOut();
      setMessage(error ? "Abmeldung konnte nicht bestätigt werden. Bitte Verbindung prüfen." : "Du bist abgemeldet. Lokale Offline-Daten bleiben auf diesem Gerät.");
    } catch {
      setMessage("Abmeldung konnte nicht bestätigt werden. Bitte Verbindung prüfen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[1.5rem] border border-cyan/25 bg-panel/72 p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-cyan/25 bg-cyan/10 text-cyan">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-mist">Supabase Konto & Cloud-Sync</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Nach Login werden Watchlist, Alerts und Portfolio serverseitig mit Supabase gespeichert.
            Ohne Login bleibt STAI im lokalen Offline-Modus nutzbar.
          </p>
        </div>
      </div>

      {session ? (
        <div className="mt-4 rounded-2xl border border-profit/25 bg-profit/10 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-profit">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-semibold">Verbunden als {safeDisplayEmail(session.user.email)}</span>
            </div>
            <button
              type="button"
              onClick={signOut}
              disabled={busy}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-stroke bg-coal px-3 text-sm font-semibold text-mist transition hover:border-loss/40 hover:text-loss disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              Abmelden
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="text-sm text-muted">E-Mail für Magic Link</span>
            <input
              value={email}
              type="email"
              maxLength={MAX_AUTH_EMAIL_LENGTH}
              onChange={(event) => setEmail(event.target.value.slice(0, MAX_AUTH_EMAIL_LENGTH))}
              placeholder="deine@email.de"
              className="mt-2 h-11 w-full rounded-xl border border-stroke bg-coal px-3 text-mist outline-none focus:border-cyan"
            />
          </label>
          <button
            type="button"
            onClick={signIn}
            disabled={!supabase || busy || !email.trim()}
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-cyan px-4 font-semibold text-ink transition hover:bg-cyan/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Mail className="h-4 w-4" />
            Login-Link senden
          </button>
        </div>
      )}

      {message ? <p className="mt-3 rounded-xl border border-stroke bg-coal px-3 py-2 text-xs text-muted">{message}</p> : null}
    </section>
  );
}
