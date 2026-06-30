"use client";

import type { Session } from "@supabase/supabase-js";
import { CheckCircle2, LogOut, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function SupabaseAuthPanel() {
  const supabase = createSupabaseBrowserClient();
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(supabase ? "" : "Supabase ENV fehlt. Login ist lokal deaktiviert.");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, [supabase]);

  async function signIn() {
    if (!supabase || !email.trim()) return;

    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/settings`
      }
    });
    setBusy(false);
    setMessage(error ? error.message : "Magic Link wurde gesendet. Bitte E-Mail prüfen.");
  }

  async function signOut() {
    if (!supabase) return;

    setBusy(true);
    await supabase.auth.signOut();
    setBusy(false);
    setMessage("Du bist abgemeldet. Lokale Offline-Daten bleiben auf diesem Gerät.");
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
              <span className="text-sm font-semibold">Verbunden als {session.user.email}</span>
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
              onChange={(event) => setEmail(event.target.value)}
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
