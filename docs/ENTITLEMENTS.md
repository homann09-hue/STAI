# Berechtigungen — welche Oberfläche welche Freigabe braucht

Stand: 2026-08-08

Dieses Dokument beantwortet eine Frage, die vorher nirgends beantwortet war:
**Welche Leistung ist kostenpflichtig, und wo wird das durchgesetzt?**

## Grundsatz

Der Tarif wird ausschließlich serverseitig entschieden. Die Feature-Karte, die
der Browser bekommt, steuert nur die Darstellung — sie darf niemals die einzige
Hürde sein. §4 des Masterprompts: „Der Client darf niemals selbst bestimmen
können, welchen Tarif ein Nutzer besitzt."

Der einzige zulässige Weg, eine kostenpflichtige Route zu öffnen, ist
`requireFeature(request, featureId)` aus `src/lib/billing/feature-guard.ts`.

## Wo die Entscheidung fällt

| Datei | Rolle |
|---|---|
| `src/lib/feature-gates.ts` | Tarife, Features, Limits — die einzige Quelle |
| `src/lib/billing/entitlements.ts` | Normalisiert den Datenbanksatz zu einem gültigen Tarif |
| `src/lib/billing/feature-access.ts` | Reine Entscheidung: erlaubt, oder Grund plus Paywall |
| `src/lib/billing/feature-guard.ts` | Serverseitige Durchsetzung, liefert die HTTP-Antwort |
| `src/components/paywall-notice.tsx` | Die Ansicht für eine abgelehnte Anfrage |

Der freischaltende Tarif wird aus `pricingTiers` **abgeleitet**, nicht daneben
gepflegt. Eine zweite Liste würde irgendwann von der Preisseite abweichen und
einen Tarif empfehlen, der die Funktion gar nicht enthält.

## Antwortcodes

| Grund | Status | Bedeutung |
|---|---|---|
| `authentication_required` | 401 | Kein Konto. Anmelden hilft |
| `plan_upgrade_required` | 402 | Konto bekannt, Tarif reicht nicht. Upgrade hilft |
| `feature_revoked` | 403 | Tarif enthielte die Funktion, Konto hat sie nicht. Upgrade hilft nicht |
| `billing_unverifiable` | 503 | Tarif nicht lesbar. Weder Zugriff noch Vorwurf |
| `feature_not_available` | 501 | Kein Tarif enthält die Funktion. Sie existiert noch nicht |

402 statt 403 im Tariffall ist Absicht: der Client muss eine Paywall von einer
echten Sperre unterscheiden können, ohne die Fehlermeldung zu lesen. Zusätzlich
tragen die Antworten `X-StockPilot-Paywall` und `X-StockPilot-Required-Plan`.

**Fail closed.** Ist der Billingstatus nicht lesbar — degradierter Lesezugriff
oder nicht konfiguriertes Supabase — wird nicht freigegeben. Ohne diese Regel
wäre eine Störung im Billing ein Gratistarif, und ein unfertig konfiguriertes
Deployment würde jede Bezahlfunktion verschenken.

**Kein geteilter Cache.** Gegatete Antworten setzen `private, no-store` statt
`s-maxage`. Andernfalls läge der Bezahlinhalt nach einem berechtigten Aufruf im
CDN und ginge an jeden weiteren Aufrufer — die Prüfung wäre wirkungslos. Die
Kostenbremse bleibt erhalten, sie sitzt serverseitig in `withCacheFallback`.

## Aktuelle Zuordnung

| Oberfläche | Route | Feature | Ab Tarif |
|---|---|---|---|
| `/markets` Marktübersicht | `/api/professional/overview` | `pro_terminal` | Pro |
| `/stocks` Aktien-Screener | dieselbe | `pro_terminal` | Pro |
| `/etfs` ETF-Screener | dieselbe | `pro_terminal` | Pro |
| `/crypto` Krypto-Screener | dieselbe | `pro_terminal` | Pro |
| `/news-terminal` | dieselbe | `pro_terminal` | Pro |
| `/risk` Risiko-Dashboard | dieselbe | `pro_terminal` | Pro |
| `/compare` Vergleiche | dieselbe | `pro_terminal` | Pro |

Frei bleiben: Dashboard `/`, Assetdetails `/assets/[symbol]`, Watchlist,
Portfolio, Alerts, Screener-Universum, Lernbereich, Trefferbilanz, Preisseite.

### Offene Produktentscheidung

Diese Zuordnung setzt die Tariftabelle um, die bereits in `feature-gates.ts`
stand (`pro_terminal` ist für Free und Starter `locked`). Sie ist keine neue
Preisentscheidung, aber zwei Punkte gehören dem Projektinhaber:

1. **News-Terminal.** Free enthält laut Tariftabelle `ai_news`. Das
   News-Terminal läuft trotzdem über `pro_terminal`, weil es Teil derselben
   Profi-Ansicht ist. Wenn Free eine einfache Nachrichtenansicht bekommen soll,
   braucht sie eine eigene, schlankere Oberfläche.
2. **Marktübersicht.** Der Masterprompt sieht für Free ein „grundlegendes
   Marktdashboard" vor. Das erfüllt derzeit die Startseite `/`. Ob `/markets`
   zusätzlich eine reduzierte Free-Variante bekommt, ist offen.

## Mengenbegrenzungen

Getrennt von den Features und bereits vorher durchgesetzt:

| Limit | Route |
|---|---|
| `watchlistItems` | `/api/watchlist` |
| `alerts` | `/api/alerts` |
| `portfolios` | `/api/portfolio/books` |

**Noch nicht durchgesetzt:** `aiAnalysesPerDay` und `apiRequestsPerDay` sind in
`feature-gates.ts` definiert, werden aber an keiner Stelle geprüft. Solange das
so ist, sind sie ein Versprechen ohne Wirkung — siehe `docs/PROGRESS_MATRIX.md`.
