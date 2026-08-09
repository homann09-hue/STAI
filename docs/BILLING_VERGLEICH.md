# Zwei Billing-Implementierungen — Vergleich

Stand 2026-08-09 · verglichen wurde `main` (0cd3039, deine VS-Code-Arbeit) gegen
`codex/enterprise-saas-billing-20260711` (2a05b16).

Vier Dateien existieren doppelt, weil wir parallel dasselbe gebaut haben:
`lib/billing/stripe.ts`, `api/billing/checkout`, `api/billing/portal`,
`api/billing/webhook`.

Dieses Dokument entscheidet nichts. Es legt offen, was jede Fassung kann.

## Der Befund, der alles andere überlagert

**Die Tarifbezeichner sind unvereinbar.**

```
main (deine Fassung):   free · starter · pro · elite
mein Branch:            free · pro · premium
```

Deine Billing-Route validiert `z.enum(["starter", "pro", "elite"])`. Das ist das
**alte, vierstufige** Modell. Meine Fassung baut auf `pro/premium` — der
Struktur, für die du dich in dieser Sitzung ausdrücklich entschieden hast
(„die erste variante. die neue").

Das ist kein Stilunterschied. Setzt sich deine Fassung durch, kehrt das alte
Tarifmodell zurück und die Umstellung von 23 Merkmalen, Limits und der
Preisseite müsste rückgängig gemacht werden.

Zusätzlich wäre der Zustand nach einem Merge **typunsauber**: deine Route
castet `parsed.data.plan as PlanId`, und `PlanId` kennt „starter" und „elite"
auf meinem Branch nicht mehr. Der Cast würde den Fehler vor dem Compiler
verbergen, statt ihn zu zeigen.

## Was beide Fassungen richtig machen

Beide bestehen die drei Prüfungen, an denen Billing-Code üblicherweise scheitert:

| Prüfung | deine | meine |
|---|---|---|
| Webhook-Signatur wird verifiziert | ✅ | ✅ |
| Entitlements nur über den Service-Role-Client | ✅ | ✅ |
| Plan wird **serverseitig** aus der Stripe-Preis-ID abgeleitet | ✅ | ✅ |

Der dritte Punkt ist §4 wörtlich: der Client bestimmt nie, welchen Tarif jemand
hat. Beide Fassungen halten das ein.

## Wo sie sich unterscheiden

| Merkmal | deine | meine |
|---|---|---|
| Tarifmodell | starter/pro/elite (alt) | pro/premium (deine Entscheidung) |
| Jahresabo | — | ✅ eigene Preis-IDs je Intervall |
| Idempotenz im Webhook | — | ✅ Status und `processed_at` |
| Idempotenz beim Checkout | — | ✅ `idempotencyKey` |
| Schutz vor Doppelabo | — | ✅ 409 bei aktivem Abo |
| Rückkehr-URL | aus Umgebungsvariable | gegen Allowlist geprüft |
| Rechnungsliste | — | ✅ eigene Route |
| Kunde aktiv anlegen | ✅ `ensureStripeCustomer` | — nutzt vorhandene oder E-Mail |
| Strukturiertes Logging | — | ✅ |

## Ein Fund in deiner Fassung, der unabhängig von der Entscheidung behoben werden sollte

`api/billing/checkout/route.ts`, letzte Zeilen:

```ts
return jsonError(
  "Checkout konnte nicht gestartet werden…",
  502,
  { "X-StockPilot-Billing-Error": String((error as Error)?.message ?? "unknown") }
);
```

Die **rohe Stripe-Fehlermeldung geht in einen Antwort-Header**. Stripe-Meldungen
enthalten regelmäßig Konfigurationsdetails — fehlende Preis-IDs, Kontozustände,
gelegentlich Objekt-IDs. Jeder Aufrufer, der einen Fehler provozieren kann,
liest sie mit.

Dasselbe Muster steht im Webhook bei der Signaturprüfung:
`{ error: String((error as Error)?.message ?? "unknown") }` wird geloggt — dort
ist es unbedenklich, weil es im Log bleibt.

## Ein Fund in meiner Fassung

`ensureStripeCustomer` fehlt mir. Ich verlasse mich darauf, dass Stripe aus
`customer_email` einen Kunden anlegt. Deine Fassung legt ihn ausdrücklich an und
bindet ihn an die Nutzer-ID — das ist die sauberere Reihenfolge und
nachvollziehbarer, wenn später Rechnungen zugeordnet werden müssen.

## Meine Empfehlung — deine Entscheidung

Meine Fassung als Grundlage, weil sie zum beschlossenen Tarifmodell passt und
Idempotenz, Jahresabo und Doppelabo-Schutz mitbringt. Aus deiner Fassung
übernehmen:

1. `ensureStripeCustomer` — die ausdrückliche Kundenanlage
2. sonst nichts, was den Tarifbezeichnern widerspricht

Der Header mit der Stripe-Fehlermeldung sollte in **keiner** Fassung überleben.

Falls du deine Fassung bevorzugst, ist der Preis benannt: das alte Tarifmodell
kehrt zurück, und Jahresabo, Idempotenz sowie der Doppelabo-Schutz müssten neu
gebaut werden.
