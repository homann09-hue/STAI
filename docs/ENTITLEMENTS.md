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

Die Tagesquoten `aiAnalysesPerDay` und `apiRequestsPerDay` sind seit dem
2026-08-08 wirksam und im nächsten Abschnitt beschrieben.

## Tagesquoten (seit 2026-08-08 wirksam)

| Quote | Free | Starter | Pro | Elite | Durchgesetzt in |
|---|---|---|---|---|---|
| `aiAnalysesPerDay` | 3 | 20 | 100 | 1.000 | `GET /api/ai/analysis` |
| `apiRequestsPerDay` | 0 | 0 | 1.000 | 10.000 | noch keine Route |

Gezaehlt wird in `public.feature_usage`, je Konto, Funktion und **UTC-Tag**.
Eine Quote, die sich mit der Zeitzone des Aufrufers verschiebt, laesst sich
durch eine geaenderte Systemzeit umgehen.

**Atomar.** Erhoehen und Grenzpruefung stehen in einer einzigen Anweisung
(`on conflict ... do update ... where used < limit`). Waeren es zwei Schritte,
koennten zwei gleichzeitige Anfragen beide die letzte freie Einheit sehen.

**Nicht im Arbeitsspeicher.** Vercel startet Funktionen kalt und parallel; ein
Zaehler im Prozess wuerde bei jedem Kaltstart auf null springen und waere damit
eine Scheinkontrolle.

**Kein Selbstbedienungszaehler.** `authenticated` darf den eigenen Verbrauch
lesen, aber nicht schreiben. Wer seinen Zaehler zuruecksetzen kann, hat keine
Quote. Die zaehlende Funktion ist `SECURITY DEFINER` mit gepinntem
`search_path`, das Ausfuehrungsrecht liegt allein bei `service_role`.

**Fail closed.** Antwortet die Quotentabelle nicht, wird mit 503 abgelehnt und
nichts verbraucht -- sonst waere eine Stoerung ein unbegrenztes Kontingent.

**Antwort bei Ueberschreitung:** HTTP 429 mit `Retry-After`, den Kopfzeilen
`X-StockPilot-Quota-*` und einem Body, der Verbrauch, Grenze, Ruecksetzzeitpunkt
und den naechsthoeheren Tarif nennt. Eine Grenze von null wird ausdruecklich als
"nicht im Tarif enthalten" formuliert und nicht als "morgen wieder verfuegbar" --
das waere schlicht falsch.

## Kostenzaehlung (§7, seit 2026-08-08)

`public.provider_usage` zaehlt je **Tag, Konto, Tarif und Anbieter**, getrennt
nach echten Abrufen und Cache-Treffern.

**Die Zaehlung verzoegert nie eine Antwort.** Sie laeuft nebenher und wird nicht
abgewartet. Ein Nutzer soll nicht laenger auf seine Kurse warten, weil eine
Statistik geschrieben wird. Ein Fehler beim Zaehlen bricht nichts ab --
Buchhaltung darf nie die Funktion beschaedigen, ueber die sie Buch fuehrt.

**Abrufe ohne Konto verschwinden nicht.** Sie werden mit `user_id = null`
gefuehrt und getrennt ausgewiesen: Teil der Gesamtkosten, aber keinem Tarif
zurechenbar. Technisch braucht das zwei partielle eindeutige Indizes, weil ein
normaler Schluessel NULL nicht dedupliziert.

**Die Zahlen gehoeren dem Betreiber.** `authenticated` darf `provider_usage`
weder lesen noch schreiben -- kein Konto soll sehen, was andere kosten.
`GET /api/admin/cost-metrics` liegt hinter `STOCKPILOT_ADMIN_SECRET`, nicht
hinter einem Tarif: das sind Betriebszahlen, keine Produktfunktion.

Die Antwort nennt Gesamtkosten, Cache-Ersparnis, Trefferquote, Kosten je Tarif
mit Margenurteil und die teuersten Konten. Kosten sind aus dokumentierten
Anbietertarifen **abgeleitet, nicht abgerechnet** -- das steht auch im
`disclaimer` der Antwort.
