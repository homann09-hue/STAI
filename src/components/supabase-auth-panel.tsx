"use client";

import type { Session } from "@supabase/supabase-js";
import { CheckCircle2, Download, LogOut, Mail, ShieldCheck, Trash2 } from "lucide-react";
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
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

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

  async function exportAccountData() {
    if (!session) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/account/export", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (!response.ok) throw new Error("export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `stockpilot-user-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage("Datenexport wurde erstellt. Die Datei kann personenbezogene Finanzdaten enthalten und sollte sicher aufbewahrt werden.");
    } catch {
      setMessage("Datenexport konnte nicht erstellt werden. Bitte Verbindung und Session prüfen.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (!supabase || !session || deleteConfirmation !== "KONTO LÖSCHEN") return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ confirmation: deleteConfirmation })
      });
      if (!response.ok) throw new Error("delete failed");
      await supabase.auth.signOut({ scope: "global" });
      for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
        const key = window.localStorage.key(index);
        if (key?.startsWith("stockpilot:")) window.localStorage.removeItem(key);
      }
      setSession(null);
      setDeleteConfirmation("");
      setMessage("Cloud-Konto und lokale StockPilot-Daten wurden gelöscht.");
    } catch {
      setMessage("Konto konnte nicht vollständig gelöscht werden. Es wurden keine lokalen Daten entfernt.");
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
          <div className="mt-4 grid gap-3 border-t border-profit/20 pt-4 md:grid-cols-2">
            <button
              type="button"
              onClick={exportAccountData}
              disabled={busy}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-cyan/30 bg-cyan/10 px-3 text-sm font-semibold text-cyan disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              Meine Daten exportieren
            </button>
            <div className="rounded-xl border border-loss/25 bg-loss/10 p-3">
              <label className="text-xs text-muted" htmlFor="delete-account-confirmation">
                Zum Löschen exakt „KONTO LÖSCHEN“ eingeben
              </label>
              <input
                id="delete-account-confirmation"
                value={deleteConfirmation}
                maxLength={20}
                onChange={(event) => setDeleteConfirmation(event.target.value.slice(0, 20))}
                className="mt-2 h-10 w-full rounded-lg border border-loss/30 bg-coal px-3 text-sm text-mist outline-none focus:border-loss"
              />
              <button
                type="button"
                onClick={deleteAccount}
                disabled={busy || deleteConfirmation !== "KONTO LÖSCHEN"}
                className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-loss/40 text-sm font-semibold text-loss disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Konto endgültig löschen
              </button>
            </div>
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
