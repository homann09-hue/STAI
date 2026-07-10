"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, Coins, Landmark, Layers3, PiggyBank, RotateCcw, ShieldAlert, TrendingUp } from "lucide-react";

const LEARN_PROGRESS_KEY = "stockpilot:learn-progress";
const PRACTICE_PROGRESS_KEY = "stockpilot:practice-progress";
const MAX_PROGRESS_STORAGE_BYTES = 12_000;

const lessons = [
  {
    icon: Landmark,
    title: "Was ist eine Aktie?",
    text: "Eine Aktie ist ein kleiner Anteil an einem Unternehmen. Ihr Wert schwankt, weil Erwartungen, Gewinne, Zinsen und Stimmung sich ändern."
  },
  {
    icon: Layers3,
    title: "Was ist ein ETF?",
    text: "Ein ETF bündelt viele Wertpapiere. Dadurch sinkt oft das Einzelwertrisiko, trotzdem bleibt Marktrisiko bestehen."
  },
  {
    icon: Coins,
    title: "Was ist Krypto?",
    text: "Krypto-Assets sind digitale Vermögenswerte mit sehr hoher Schwankung. Sie brauchen besonders strenge Risikogrenzen."
  },
  {
    icon: ShieldAlert,
    title: "Was ist Risiko?",
    text: "Risiko bedeutet nicht nur Verlust. Es bedeutet Unsicherheit, Schwankung, falsche Daten, Liquidität, Nachrichten und dein Verhalten unter Stress."
  },
  {
    icon: PiggyBank,
    title: "Was bedeutet Diversifikation?",
    text: "Du verteilst Kapital auf mehrere Anlageklassen, Regionen und Themen, damit ein einzelner Fehler nicht das ganze Portfolio trifft."
  },
  {
    icon: TrendingUp,
    title: "Langfristig investieren",
    text: "Langfristig heißt: Plan, Kostenkontrolle, regelmäßige Prüfung und genug Reserve, statt ständig hektisch auf jede Kursschwankung zu reagieren."
  }
];

const samplePlans = [
  ["1 €", "Lernen, App verstehen, Risiko-Logik testen"],
  ["25 € mtl.", "ETF-Grundlage simulieren, Watchlist aufbauen"],
  ["100 € mtl.", "Core-Satellite-Ansatz testen"],
  ["500 € mtl.", "Diversifikation, Rebalancing und Alerts nutzen"],
  ["1.000 € mtl.", "Portfolio-Risiko, Steuer- und Kostenstruktur prüfen"]
];

const glossary = [
  ["Dividende", "Ausschüttung eines Unternehmens an Aktionäre, nicht zugesichert."],
  ["Drawdown", "Rückgang vom Hochpunkt bis zum Tiefpunkt einer Position oder Strategie."],
  ["Volatilität", "Wie stark ein Kurs schwankt."],
  ["Korrelation", "Wie ähnlich sich zwei Anlagen bewegen."],
  ["KGV", "Preis im Verhältnis zum Gewinn. Nützlich, aber nie allein ausreichend."],
  ["Datenqualität", "Wie frisch, vollständig und belastbar die Datenbasis ist."]
];

const learningTracks = [
  {
    title: "Start mit 1 €",
    focus: "Begriffe verstehen, Risiko-Hinweise lesen, keine echten Entscheidungen aus Demo-Daten ableiten.",
    href: "/settings",
    action: "Datenqualität prüfen"
  },
  {
    title: "Erste Watchlist",
    focus: "3 bis 10 Assets beobachten, Qualitäts-Badges verstehen und keine Kursdaten ohne Quelle bewerten.",
    href: "/watchlist",
    action: "Watchlist öffnen"
  },
  {
    title: "Portfolio-Denken",
    focus: "Positionsgröße, Gewichtung, Diversifikation und Klumpenrisiko vor Renditefantasie prüfen.",
    href: "/portfolio",
    action: "Portfolio simulieren"
  },
  {
    title: "Profi-Analyse",
    focus: "Fundamentaldaten, News, technische Signale und Szenarien getrennt betrachten.",
    href: "/screener",
    action: "Screener nutzen"
  }
];

const practiceChecklist = [
  "Öffne eine Asset-Detailseite und suche den Datenqualitäts-Badge.",
  "Vergleiche mindestens zwei Assetklassen, bevor du ein Risiko beurteilst.",
  "Prüfe bei jeder News Quelle, Datum, Relevanz und Mock-/Live-Status.",
  "Lege eine Watchlist an und beobachte zuerst, statt sofort zu handeln.",
  "Simuliere eine kleine Position und prüfe Gewichtung, Drawdown und Klumpenrisiko."
];

function parseStoredProgress(raw: string | null, allowed: readonly string[]) {
  if (!raw) return [];
  if (raw.length > MAX_PROGRESS_STORAGE_BYTES) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) return [];

    const allowedSet = new Set(allowed);
    return parsed.filter((item): item is string => typeof item === "string" && allowedSet.has(item));
  } catch {
    return [];
  }
}

export function LearnView() {
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [completedPractice, setCompletedPractice] = useState<string[]>([]);
  const progress = useMemo(() => Math.round((completedLessons.length / lessons.length) * 100), [completedLessons.length]);
  const practiceProgress = useMemo(() => Math.round((completedPractice.length / practiceChecklist.length) * 100), [completedPractice.length]);
  const learningStatus = progress >= 80 ? "Analysebereit" : progress >= 45 ? "Auf gutem Weg" : "Grundlagen offen";
  const learningStatusTone = progress >= 80 ? "text-profit" : progress >= 45 ? "text-amber" : "text-cyan";

  useEffect(() => {
    try {
      setCompletedLessons(parseStoredProgress(window.localStorage.getItem(LEARN_PROGRESS_KEY), lessons.map((lesson) => lesson.title)));
      setCompletedPractice(parseStoredProgress(window.localStorage.getItem(PRACTICE_PROGRESS_KEY), practiceChecklist));
    } catch {
      setCompletedLessons([]);
      setCompletedPractice([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(LEARN_PROGRESS_KEY, JSON.stringify(completedLessons));
    } catch {
      // Lernen bleibt auch ohne localStorage nutzbar.
    }
  }, [completedLessons]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PRACTICE_PROGRESS_KEY, JSON.stringify(completedPractice));
    } catch {
      // Praxis-Checkliste bleibt auch ohne localStorage nutzbar.
    }
  }, [completedPractice]);

  function toggleLesson(title: string) {
    setCompletedLessons((current) =>
      current.includes(title) ? current.filter((item) => item !== title) : [...current, title]
    );
  }

  function togglePractice(item: string) {
    setCompletedPractice((current) =>
      current.includes(item) ? current.filter((entry) => entry !== item) : [...current, item]
    );
  }

  return (
    <div className="space-y-7">
      <section className="rounded-[1.6rem] border border-cyan/20 bg-[radial-gradient(circle_at_top_left,rgba(120,231,255,0.16),transparent_32%),linear-gradient(145deg,#101712,#050706_70%)] p-5 shadow-panel sm:p-7">
          <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan/30 bg-cyan/10 text-cyan">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-muted">Investieren lernen</p>
            <h1 className="text-3xl font-semibold sm:text-4xl">Finanzwissen ohne Nebelmaschine.</h1>
          </div>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-muted">
          Von 1 € Testkapital bis großem Portfolio: Dieser Bereich erklärt Begriffe einfach,
          zeigt Beispielpläne und verbindet Lernen direkt mit Watchlist, Alerts und Risikoanalyse.
        </p>
        <div className="mt-5 rounded-2xl border border-stroke bg-coal/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-mist">Lernfortschritt</p>
              <p className="mt-1 text-xs text-muted">{completedLessons.length} von {lessons.length} Grundlagen markiert</p>
            </div>
            <div className="flex items-center gap-2">
              <p className={`hidden rounded-full border border-stroke bg-panel px-3 py-2 text-xs font-semibold sm:block ${learningStatusTone}`}>
                {learningStatus}
              </p>
              <p className="font-mono text-cyan">{progress}%</p>
              <button
                type="button"
                onClick={() => setCompletedLessons([])}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-stroke bg-panel px-3 text-xs font-semibold text-muted transition hover:text-mist"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Zurücksetzen
              </button>
              <button
                type="button"
                onClick={() => setCompletedLessons(lessons.map((lesson) => lesson.title))}
                className="hidden h-9 rounded-xl border border-profit/25 bg-profit/10 px-3 text-xs font-semibold text-profit transition hover:bg-profit/15 sm:inline-flex sm:items-center"
              >
                Alle markieren
              </button>
            </div>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-stroke">
            <div className="h-full rounded-full bg-profit transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs leading-5 text-muted">
            Fortschritt wird lokal auf diesem Gerät gespeichert. Keine Finanzentscheidung hängt davon ab.
          </p>
          <p className="mt-2 rounded-xl border border-cyan/20 bg-cyan/10 p-3 text-xs leading-5 text-cyan sm:hidden">
            Status: {learningStatus}
          </p>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {lessons.map((lesson) => {
          const Icon = lesson.icon;
          const done = completedLessons.includes(lesson.title);

          return (
            <article key={lesson.title} className="rounded-[1.3rem] border border-stroke bg-panel p-5 shadow-panel">
              <div className="flex items-start justify-between gap-3">
                <Icon className="h-5 w-5 text-profit" />
                <button
                  type="button"
                  aria-pressed={done}
                  onClick={() => toggleLesson(lesson.title)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    done ? "border-profit/30 bg-profit/10 text-profit" : "border-stroke bg-coal text-muted hover:text-mist"
                  }`}
                >
                  {done ? "verstanden" : "markieren"}
                </button>
              </div>
              <h2 className="mt-4 text-lg font-semibold">{lesson.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{lesson.text}</p>
            </article>
          );
        })}
      </section>

      <section className="rounded-[1.3rem] border border-stroke bg-panel p-5">
        <h2 className="text-xl font-semibold">Geführte Lernpfade</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Jeder Pfad führt dich in einen produktiven App-Bereich. Ziel ist Verständnis und Risikokontrolle, nicht schnelle Gewinnversprechen.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {learningTracks.map((track) => (
            <article key={track.title} className="rounded-2xl border border-stroke bg-ink/45 p-4">
              <p className="font-semibold text-cyan">{track.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{track.focus}</p>
              <Link href={track.href} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-profit/30 bg-profit/10 px-3 py-2 text-sm font-semibold text-profit">
                {track.action}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[1.3rem] border border-stroke bg-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Praxis-Checkliste für sichere Nutzung</h2>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-cyan/25 bg-cyan/10 px-3 py-2 font-mono text-xs text-cyan">{practiceProgress}%</span>
            <button
              type="button"
              onClick={() => setCompletedPractice([])}
              className="rounded-full border border-stroke bg-coal px-3 py-2 text-xs font-semibold text-muted transition hover:text-mist"
            >
              Praxis zurücksetzen
            </button>
          </div>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted">
          Diese Punkte helfen dabei, StockPilot nicht als Orakel zu benutzen, sondern als Analysewerkzeug mit klaren Grenzen.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {practiceChecklist.map((item, index) => (
            <div key={item} className="flex items-start gap-3 rounded-2xl border border-stroke bg-ink/45 p-4">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-profit/25 bg-profit/10 font-mono text-xs text-profit">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-6 text-muted">{item}</p>
                <button
                  type="button"
                  aria-pressed={completedPractice.includes(item)}
                  onClick={() => togglePractice(item)}
                  className={`mt-3 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    completedPractice.includes(item) ? "border-profit/30 bg-profit/10 text-profit" : "border-stroke bg-coal text-muted hover:text-mist"
                  }`}
                >
                  {completedPractice.includes(item) ? "erledigt" : "als erledigt markieren"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-[1.3rem] border border-stroke bg-panel p-5">
          <h2 className="text-xl font-semibold">Beispiel-Portfolios</h2>
          <div className="mt-4 space-y-3">
            {samplePlans.map(([amount, goal]) => (
              <div key={amount} className="rounded-2xl border border-stroke bg-ink/45 p-4">
                <p className="font-mono text-2xl font-semibold text-cyan">{amount}</p>
                <p className="mt-1 text-sm text-muted">{goal}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.3rem] border border-stroke bg-panel p-5">
          <h2 className="text-xl font-semibold">Glossar</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {glossary.map(([term, explanation]) => (
              <div key={term} className="rounded-2xl bg-panel2 p-4">
                <p className="font-semibold">{term}</p>
                <p className="mt-2 text-sm leading-6 text-muted">{explanation}</p>
              </div>
            ))}
          </div>
          <Link
            href="/"
            className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-profit/30 bg-profit/10 px-4 py-3 text-sm font-semibold text-profit"
          >
            Zum Dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
