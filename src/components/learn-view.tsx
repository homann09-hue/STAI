"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Coins, Landmark, Layers3, PiggyBank, ShieldAlert, TrendingUp } from "lucide-react";

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

export function LearnView() {
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
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {lessons.map((lesson) => {
          const Icon = lesson.icon;

          return (
            <article key={lesson.title} className="rounded-[1.3rem] border border-stroke bg-panel p-5 shadow-panel">
              <Icon className="h-5 w-5 text-profit" />
              <h2 className="mt-4 text-lg font-semibold">{lesson.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{lesson.text}</p>
            </article>
          );
        })}
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
