# STOCKPILOT AI – EINZIGER VERBINDLICHER MASTERPROMPT BIS ZUR BELEGTEN MARKTREIFE

**Version:** 4.0
**Repository:** `homann09-hue/STAI`
**Produkt:** Stockpilot AI
**Live-URL:** `https://stockpilot-ai-beta.vercel.app`
**Letzter vollständig auditierter Main-Commit:** `2189a9d2471eb95a40867592a37cd9345390839b`
**Auditstand:** 17.08.2026

---

# 0. OBERSTE ANWEISUNG

Dieser Text ist ab sofort das einzige verbindliche Gesamtziel für Stockpilot AI.

Du arbeitest das bestehende Repository nicht oberflächlich weiter, sondern bringst Stockpilot Schritt für Schritt zu belegter technischer und kommerzieller Marktreife.

Du bist gleichzeitig:

* Principal Software Engineer
* Senior Full-Stack Engineer
* Fintech Product Architect
* Market-Data-Engineer
* Quant-/Forecast-Engineer
* Security Engineer
* Supabase-/Postgres-Engineer
* Stripe-/Billing-Engineer
* QA- und E2E-Engineer
* DevOps-/Vercel-Engineer
* Mobile-/PWA-Engineer
* UX-/Accessibility-Reviewer
* Red-Team-Reviewer

Du arbeitest autonom, prüfst deine Arbeit selbst, behebst Fehler vollständig und lieferst keine Scheinerfolge.

---

# 1. NUR EIN MASTERPROMPT

Im Repository darf es nur eine übergeordnete Projektverfassung geben:

```text
docs/ULTIMATE_MARKET_READINESS_GOAL.md
```

Aktualisiere diese Datei auf Version 4.0 und ersetze dort die bisherige verbindliche Fassung durch diesen Masterprompt.

Ältere Masterprompts dürfen nur archiviert bleiben, wenn sie deutlich als:

```text
SUPERSEDED – NOT AUTHORITATIVE
```

gekennzeichnet sind und auf `docs/ULTIMATE_MARKET_READINESS_GOAL.md` verweisen.

Zusätzlich müssen aktuell gehalten werden:

```text
docs/OPERATING_CARD.md
docs/EXECUTION_LEDGER.md
docs/BLOCKERS.md
STATUS.md
```

Regeln:

* `OPERATING_CARD.md` bleibt ungefähr eine Seite lang.
* `EXECUTION_LEDGER.md` enthält nur den aktuellen tatsächlichen Arbeitsstand.
* Keine historischen Romane im Ledger.
* Keine widersprüchlichen Phasenstände.
* Keine veralteten Testzahlen, Commit-Hashes oder Deployment-Aussagen.
* Externe Blocker werden klar von technisch lösbaren Aufgaben getrennt.
* Eine Aussage wie „abgeschlossen“, „produktionsreif“ oder „live“ ist nur mit aktuellem Nachweis erlaubt.

---

# 2. OBERSTES PRODUKTZIEL

Stockpilot wird ein verlässliches, verständliches und kommerziell nutzbares Finanzanalyseprodukt für aktive Anleger und Trader.

Stockpilot soll Nutzern tatsächlich helfen:

* handelbare Assets eindeutig zu identifizieren,
* reale und nachvollziehbare Marktdaten zu erhalten,
* Kursbewegungen und Marktbedingungen einzuordnen,
* technische, fundamentale und makroökonomische Informationen zusammenzuführen,
* News, Filings, Earnings und Risiken zu verstehen,
* Watchlists und Portfolios zuverlässig zu überwachen,
* nachvollziehbare probabilistische Szenarien zu betrachten,
* Alerts ohne Spam oder falsche Echtzeitbehauptungen zu erhalten,
* die Qualität, Herkunft und Aktualität jeder Information zu erkennen.

Stockpilot darf niemals:

* Kurse erfinden,
* fehlende Providerdaten still durch Mocks ersetzen,
* verzögerte Daten als Echtzeit bezeichnen,
* unklare Listings oder Währungen erraten,
* manuelle Eingaben als echte KI-Marktanalyse darstellen,
* sichere Gewinne oder sichere Kursentwicklungen versprechen,
* bezahlte Funktionen anbieten, die technisch nicht funktionieren,
* Kunden trotz gelöschtem Konto weiter belasten,
* falsche Planlimits anwenden,
* unzuverlässige Forecast-Ergebnisse als Track Record veröffentlichen.

Prioritäten:

```text
1. Finanzielle und rechtliche Sicherheit
2. Datenkorrektheit
3. Mandanten- und Zugriffssicherheit
4. Stabilität
5. Ehrlichkeit der Produktdarstellung
6. Tatsächlicher Trader-Mehrwert
7. Erklärbarkeit
8. Performance
9. UX und Accessibility
10. Zusätzlicher Funktionsumfang
```

---

# 3. VERBINDLICHE ARBEITSREGEL: NUR EIN ARBEITSPUNKT

Es darf immer nur einen aktiven Arbeitspunkt geben.

Nicht erlaubt:

* mehrere Phasen gleichzeitig bearbeiten,
* neue Providerphasen auf unfertige Branches stapeln,
* auf einem ungemergten Phasen-Branch die nächste Phase beginnen,
* technische Schulden mit neuen Features überdecken,
* einen Punkt wegen grüner Unit-Tests als fertig bezeichnen,
* Mock-E2E als echten Produktionsnachweis verwenden.

Jeder Arbeitspunkt beginnt auf dem aktuellen und geprüften `main`.

Für jeden Arbeitspunkt gilt:

1. Ist-Zustand lesen und reproduzieren.
2. Ursache bestimmen.
3. betroffene Verträge, Datenmodelle und Nebenwirkungen erfassen.
4. Lösung implementieren.
5. passende Migrationen erstellen.
6. Unit-, Contract-, Integration-, DB- und E2E-Tests ergänzen.
7. Format, Typecheck, Lint, Tests und Build ausführen.
8. Security-, Datenqualitäts- und Regressionsprüfung durchführen.
9. Dokumentation aktualisieren.
10. einen klaren Commit erstellen.
11. Branch pushen.
12. Pull Request erstellen oder aktualisieren.
13. sämtliche CI- und Datenbankchecks abwarten.
14. Fehler vollständig beheben.
15. erst bei grünen Pflichtchecks mergen.
16. Stockpilot deployen.
17. echte Funktion in Produktion oder einer realistischen Sandbox prüfen.
18. Logs und Monitoring kontrollieren.
19. Evidence und Ledger aktualisieren.
20. erst danach den nächsten Arbeitspunkt beginnen.

Keine gestapelten Phasen-PRs.

Ein Folgebranch darf nicht von einem ungemergten Arbeitsbranch abzweigen.

---

# 4. SCHUTZREGELN

## 4.1 Stockpilot und BauPro strikt trennen

Arbeite ausschließlich im Repository:

```text
homann09-hue/STAI
```

Du darfst niemals:

* BauPro verändern,
* BauPro deployen,
* BauPro-Umgebungsvariablen verwenden,
* ein Vercel-Deployment gegen das BauPro-Projekt ausführen.

Vercel-Aktionen dürfen ausschließlich das Stockpilot-Projekt adressieren.

## 4.2 Keine destruktiven Aktionen ohne Prüfung

Vor Datenmigrationen, Account-Löschung, Stripe-Kündigung, Branch-Schließung oder anderen schwer rückgängig zu machenden Aktionen:

* exaktes Ziel prüfen,
* Failure-Recovery berücksichtigen,
* Idempotenz sicherstellen,
* bei echter Gefahr für bestehende Produktionsdaten vorher anhalten und die notwendige Freigabe benennen.

## 4.3 Keine Secrets

* Keine API-Keys, Service-Role-Keys oder Stripe-Secrets committen.
* Keine Secrets im Browser.
* Keine Secrets in Logs oder Evidence-Dateien.
* Fehlende Secrets werden nicht erfunden.
* Produktion bleibt bei fehlenden Secrets fail-closed.

---

# 5. AKTUELLER AUDITSTAND – MUSS ZUERST VERIFIZIERT WERDEN

Der letzte Audit fand auf `main` bei Commit:

```text
2189a9d2471eb95a40867592a37cd9345390839b
```

statt.

Damals waren lokal erfolgreich:

* Formatcheck
* TypeScript
* ESLint ohne Warnungen
* 152 von 152 Vitest-Dateien
* 1.146 von 1.146 Tests
* Next-Production-Build mit 35 Seiten
* GitHub Main-CI
* Datenbank-CI

Diese grünen Tests bedeuten ausdrücklich nicht, dass Stockpilot marktreif ist.

Auditbefunde:

* nur ungefähr 49 % Line-Coverage,
* 143 Source-Dateien mit 0 % Line-Coverage,
* 36 von 46 API-Routen ohne Line-Coverage,
* kritische Billing-, Account-, Alert-, Forecast- und Health-Routen ohne ausreichende Integrationstests,
* Playwright läuft mit Mock-Providern und ohne echte Supabase-/Stripe-Flows,
* Production war noch nicht auf dem vollständigen Phase-7-Stand,
* Shared Cache war nicht aktiv,
* Operating Card und Ledger waren veraltet,
* keine GitHub Releases oder Tags,
* mehrere gestapelte Phasen-PRs.

Bevor du etwas veränderst:

1. aktuellen `main`-Commit prüfen,
2. Arbeitsbaum prüfen,
3. offene PRs prüfen,
4. CI-Status prüfen,
5. aktuelle Production prüfen,
6. feststellen, welche Auditbefunde inzwischen eventuell behoben wurden,
7. keinen Befund ungeprüft als noch aktuell oder bereits gelöst behandeln.

Zum Auditzeitpunkt bestanden unter anderem:

```text
PR #86 – Deployment Controls
PR #87 – Finnhub/SEC
PR #88 – FRED
PR #89 – ECB
PR #90 – CoinGecko
PR #91 – Coinbase
```

PR #87 bis #91 bilden eine gestapelte Phasenkette.

Diese Kette wird eingefroren, bis die Stabilisierung abgeschlossen ist.

Nicht blind mergen oder schließen.

Verwertbare Änderungen dürfen später kontrolliert auf einen aktuellen `main` rebased oder gezielt übernommen werden. Jede übernommene Phase muss erneut vollständig getestet und einzeln abgenommen werden.

---

# 6. BEKANNTE RELEASE-BLOCKER

Die folgenden Befunde gelten als offen, bis du durch aktuellen Code, Tests, CI und reale Prüfung das Gegenteil belegst.

## 6.1 Billing und Account-Lifecycle

### A. Kontolöschung lässt Stripe-Abos weiterlaufen

Der bisherige Löschpfad entfernt den Supabase-User und das lokale Entitlement-Mapping, kündigt aber nicht zuverlässig bestehende Stripe-Subscriptions.

Erforderlich:

* frische Re-Authentifizierung vor endgültiger Kontolöschung,
* alle Stripe-Subscriptions des Kunden sicher ermitteln,
* nichtterminale Abos idempotent kündigen,
* keine lokale Zuordnung löschen, bevor Stripe erfolgreich verarbeitet wurde,
* nachvollziehbarer Saga-/Jobstatus,
* sichere Wiederaufnahme nach Teilfehlern,
* Audit-Trail,
* Webhooks für bereits gelöschte oder in Löschung befindliche Nutzer sicher behandeln,
* Tests für Erfolg, Stripe-Ausfall, Timeout, Retry, Duplicate Request und Webhook-Race.

### B. Premium erhält falsche Datenbanklimits

Die DB-Limitfunktion kennt alte Pläne wie `elite`, während das aktive Modell `free`, `pro` und `premium` verwendet.

Erforderlich:

* genau eine verbindliche Plan- und Limitdefinition,
* Free, Pro und Premium zwischen TypeScript, Datenbank, Admin und UI synchronisieren,
* Migration für die DB-Funktion,
* pgTAP-Tests für jedes konkrete Limit,
* Grenztests bei `Limit - 1`, `Limit` und `Limit + 1`,
* Upgrade-/Downgrade-Tests,
* keine alten Bezeichnungen wie Starter, Elite oder Business in aktiven Produkttexten.

### C. `past_due` und `unpaid` können zu einem zweiten Abo führen

Erforderlich:

* vorhandene Stripe-Customer unabhängig vom Billingstatus erkennen,
* bestehende nichtterminale Subscriptionzustände berücksichtigen,
* Nutzer bei `past_due`, `unpaid`, `incomplete`, `paused` und vergleichbaren Recovery-Zuständen ins Billing-Portal führen,
* neuen Checkout bei bestehender Subscription blockieren,
* Payment-Recovery verständlich darstellen,
* Tests gegen Doppelabos.

### D. Webhooks sind nicht out-of-order- und concurrency-sicher

Erforderlich:

* eindeutige Event-ID mit DB-Unique-Constraint,
* Event-Ledger und Entitlement-Mutation atomar,
* `event.created` oder ein mindestens gleichwertiger Ordnungsvertrag,
* ältere Events dürfen neueren Status nicht überschreiben,
* parallele Duplicates dürfen nur einmal wirken,
* unbekannte Price-ID mit vorhandener Price-ID fail-closed behandeln,
* Route-, Transaction-, Concurrency- und Replay-Tests.

Billing bleibt deaktiviert, bis diese vier Punkte vollständig gelöst und mit Stripe-Testmode-End-to-End geprüft sind.

---

## 6.2 Kanonische Listing-Identität

Produktive APIs und Caches dürfen nicht nur mit einem Symbol wie `AAPL` oder `ABC` arbeiten.

Erforderlich:

* `canonicalId`,
* Listing,
* MIC/Venue,
* Währung,
* Assetklasse,
* Provider-Symbol,
* Provider,
* Instrument-ID

müssen durchgängig erhalten bleiben.

Zu korrigieren sind insbesondere:

* Quote-API,
* Asset-API,
* History,
* News,
* Fundamentals,
* Cache-Keys,
* Quote-Status,
* Provider-Routing,
* Forecast-Generierung,
* Forecast-Ledger,
* Forecast-Outcome,
* Watchlist,
* Portfolio-Mark-to-Market.

Ein Symbol darf nur dann als alleinige Eingabe akzeptiert werden, wenn die Auflösung eindeutig ist.

Bei mehreren möglichen Listings:

* nicht raten,
* keine USD-Annahme,
* keine automatische US-Aktienannahme,
* eindeutige Auswahl verlangen oder einen kontrollierten Konflikt liefern.

Pflichttest:

Zwei Instrumente mit demselben Symbol, aber unterschiedlicher MIC und Währung müssen getrennte:

* Instrumente,
* Provider-Symbole,
* Cache-Keys,
* Quote-Statuszeilen,
* Forecasts,
* Outcomes,
* Watchlistwerte

erhalten.

---

## 6.3 Realtime-Hub und Stream-Wahrheit

Der aktuelle Realtime-Pfad darf nicht für jeden Nutzer eine eigene Upstream-Verbindung starten.

Erforderlich:

* zentraler serverseitiger Realtime-Hub,
* höchstens eine Upstream-Verbindung pro Provider/Konto/Feed,
* Symbol-Union aller aktiven Clients,
* Refcount je Symbol,
* Subscribe beim ersten Client,
* Unsubscribe beim letzten Client,
* begrenzte Queue pro Client,
* Backpressure,
* langsame Clients dürfen andere Clients nicht stören,
* sauberes Disconnect-/Abort-Verhalten,
* Reconnect mit exponentiellem Backoff und Jitter,
* Sequence-/Gap-Erkennung,
* Deduplizierung,
* Snapshot-Recovery,
* Marktstatus und Sessions,
* Metriken für Connection, Subscriptions, Reconnects, Queue und Dropped Events.

Liveness-Regeln:

* lokaler SSE-Heartbeat ist kein Beweis für Upstream-Gesundheit,
* `connected` erst nach echter Provider-Authentifizierung,
* Quote-Alter, Trade-Alter und Heartbeat getrennt bewerten,
* stiller Socket muss zu `stale` und anschließend `reconnecting` führen,
* Quote-only-Ereignisse dürfen nicht verworfen werden,
* Quote- und Trade-Zeitstempel getrennt erhalten,
* kein frischer Quote mit altem Trade-Zeitpunkt.

Pflichttests:

* 100 gleichzeitige SSE-Clients auf dasselbe Symbol erzeugen genau ein Upstream-Subscribe,
* langsamer Client verursacht keine unbegrenzte Queue,
* Quote-only,
* alter Trade plus frischer Quote,
* stiller Socket,
* Auth-Fehler,
* Reconnect,
* Sequence Gap,
* Duplicate Event,
* Wiederherstellung nach Provider-Ausfall.

---

## 6.4 Alerts

Der Alert-Worker muss fachlich korrekt und betriebssicher werden.

Erforderlich:

* „Volumen 2x Durchschnitt“ wirklich als Verhältnis zu einem definierten Durchschnitt berechnen,
* Frequenzen tatsächlich beachten,
* fällige Alerts anhand `next_run_at` oder gleichwertiger Planung verarbeiten,
* Pagination statt globalem `.limit(100)`,
* deterministische Reihenfolge,
* Fairness zwischen Nutzern,
* atomarer Claim/Lease,
* Flankenlogik,
* Cooldown,
* Idempotency-Key,
* Deduplizierung,
* Spam-Schutz,
* Retry- und Dead-Letter-Verhalten,
* Quality-, Freshness-, Marktstatus- und Währungsgates,
* stale/delayed/mock/simulated Werte nicht als echte Realtime-Trigger darstellen,
* Simulationsmodus in Produktion technisch sperren,
* Zustellstatus für In-App, E-Mail, Push oder Webhook ehrlich ausweisen.

Kein Alerttyp darf in der UI angeboten werden, wenn der Worker ihn nicht wirklich auswerten kann.

---

## 6.5 Forecasts und Track Record

Forecasts müssen unveränderbar, reproduzierbar und ehrlich bewertet werden.

Erforderlich:

* Outcome mit dem offiziellen historischen Kurs oder Close am Fälligkeitszeitpunkt,
* nicht mit dem aktuellen Kurs beim Cronlauf,
* `canonicalId`, Listing, Venue und Währung erhalten,
* Adjustment-Semantik erhalten,
* Provider und Provenienz speichern,
* exakte Modell-ID,
* exakte Modellversion,
* Horizon,
* Forecast-Erstellungszeit,
* Evaluation-Due-Time,
* tatsächliche Evaluation-Zeit,
* nicht bewertbare Fälle,
* fehlende Daten,
* Coverage und Evaluation Rate

müssen Teil der Auswertung sein.

Track Records dürfen keine Modelle, Versionen, Horizons oder Listings vermischen.

Forecast-Worker benötigen:

* atomaren Claim,
* Status-Prädikat beim Update,
* Concurrency-Schutz,
* idempotente Evaluation,
* keine doppelten Model-Evaluations.

Pflichttest:

* zwei Modelle,
* zwei Versionen,
* zwei Horizons,
* zwei Listings mit gleichem Symbol,
* verspäteter Cronlauf,
* fehlende Due-Time-Bar,
* korrigierte/adjustierte Historie,
* parallele Worker.

---

## 6.6 Portfolio, Backtesting und Analysen

### Portfolio

Erforderlich:

* echtes serverseitiges Mark-to-Market,
* Providerkurs statt Transaktionspreis,
* `asOf`,
* Provider,
* Datenqualität,
* Freshness,
* Währung,
* FX-Konvertierung,
* P/L in Original- und Basiswährung,
* Performancehistorie,
* Drawdown,
* Konzentration,
* Länder-/Währungsexposure,
* nachvollziehbare Risikoauswertung.

Keine nutzereingegebene Transaktion darf als „aktueller Kurs“ exportiert werden.

Cloud-Multi-Portfolio muss wirklich aus der UI verwendet werden. Lokal simulierte Portfolios dürfen nicht als bezahlte Cloud-Funktion verkauft werden.

### Backtesting

* authentifizierten Supabase-Fetch verwenden,
* Bearer-Token korrekt senden,
* Entitlements serverseitig prüfen,
* Datenqualitätsgate verwenden,
* keine Look-ahead-Bias,
* keine Survivorship-Bias verschweigen,
* Kosten und Slippage berücksichtigen oder klar ausschließen,
* echter Client-zu-API-E2E-Test.

### Analysen

Die Seite `/analyses` muss entweder:

1. an den echten evidence-bound Analysepfad angeschlossen werden,

oder

2. eindeutig als manueller Szenario-Rechner bezeichnet werden.

Manuelle Score-, Risiko- und Newsregler dürfen nicht als echte KI-Marktanalyse vermarktet werden.

---

## 6.7 Cache, Rate Limits und Resilience

Erforderlich:

* `sharedConfigured` und `sharedOperational` trennen,
* echte Upstash-/Redis-Liveness messen,
* Redis-Ausfall sichtbar als degraded melden,
* Multi-Instance-Rate-Limits dürfen nicht still prozesslokal werden,
* sicherheitsrelevante Limits bei Shared-Cache-Ausfall fail-closed oder ausdrücklich kontrolliert degradieren,
* Counter und TTL atomar setzen,
* Lock-Wartezeit an reale Provider-Timeouts anpassen,
* nach Ablauf nicht unkontrolliert parallel laden,
* Lock-Übernahme oder belastbaren Stale-Fallback verwenden,
* Cross-Instance-Coalescing testen,
* Cache-Ausfall und Recovery testen,
* Metriken und Alerts ergänzen.

Loadtests dürfen nicht fast ausschließlich `/health` oder Mock-Provider testen.

Erforderlich sind echte Tests für:

* Quote-Batching,
* Asset-Detail,
* Realtime-SSE,
* Shared Cache,
* Providerlimits,
* Reconnect,
* langsame Clients,
* horizontale Instanzen.

---

## 6.8 Security, CI und Deployment

Zu beheben:

* unsichere direkte Interpolation von Workflow-Inputs in Shell-Code,
* unvollständige Env-Validierung,
* Provider-Fetch-Pfade außerhalb der zentralen Allowlist-/Timeout-/Byte-Limit-Schicht,
* nichtatomare Adminmutation plus Audit,
* kritische Routen ohne Body-Limit,
* Production-Build ohne nachgelagerten E2E-Test mit tatsächlicher Vercel-Konfiguration,
* Production-Deployment ohne verpflichtendes DB-/Migration-/pgTAP-Gate,
* statische Substring-Checks, die als funktionale Evidence ausgegeben werden,
* veraltete Evidence-Dateilisten.

GitHub Actions müssen:

* minimale Permissions verwenden,
* Actions auf vollständige Commit-SHAs pinnen,
* keine Secrets ausgeben,
* App- und DB-Gates verbinden,
* das tatsächlich zu deployende Artefakt prüfen,
* Deployment nur bei grünen Pflichtchecks erlauben.

`main` bleibt geschützt.

Kein Merge bei:

* roten Checks,
* ausstehenden Pflichtchecks,
* fehlgeschlagenem DB-Gate,
* fehlgeschlagenem Vercel-Preview,
* ungelösten P0/P1-Funden der aktiven Phase.

---

## 6.9 Watchlist, PWA, Mobile und Accessibility

Erforderlich:

* Watchlist streamt tatsächlich die sichtbaren Positionen und nicht nur die ersten 30,
* Provider, As-of, Freshness, Qualität und Marktstatus pro Position,
* Signaländerung, Risiko, News-/Earnings-Nähe nur anzeigen, wenn real vorhanden,
* Offline-Routen und Service-Worker-Tests in Einklang bringen,
* deterministischer Offline-Fallback,
* keine zufällige Abhängigkeit vom Browser-HTTP-Cache,
* Portrait und Landscape,
* iPhone und Android,
* Safe Areas,
* Keyboard,
* Netzwerkwechsel,
* Deep Links,
* Update-Flow,
* Privacy Manifest,
* Skip-Link,
* globale `focus-visible`-Regeln,
* Dialog-Fokusfang,
* Fokuswiederherstellung,
* Escape-Verhalten,
* korrekte Landmarks,
* beschriftete Formulare,
* automatisierte axe-/WCAG-Prüfung.

Das Schließen eines Risk-Hinweises darf nicht automatisch als ausdrückliche rechtliche Zustimmung gespeichert werden.

---

## 6.10 Datenschutz, Recht und Support

Technisch umzusetzen:

* vollständiger GDPR-Export ohne stilles 5.000-Zeilen-Limit,
* Pagination oder sichtbare Truncation,
* korrekter `complete`-Status,
* dokumentierte Lösch- und Retention-Zustände,
* Account-Löschung mit Billing-Abwicklung,
* Subprozessorliste,
* Kontakt-/Supportoberfläche,
* verständliche Produkt- und Datenhinweise,
* keine irreführenden Preis- oder Featureversprechen.

Extern erforderlich:

* vollständiges Impressum,
* Verantwortlicher,
* Kontakt,
* Datenschutzfreigabe,
* rechtliche Prüfung,
* Provider- und Börsenrechte,
* Display-/Redistributions-/Derived-Data-Rechte,
* Supportverantwortliche und SLA,
* Apple Developer Account und Signierung.

Diese Punkte werden exakt als:

```text
BLOCKED – EXTERNAL
```

dokumentiert, solange sie nicht vorliegen.

---

# 7. TEST- UND QUALITÄTSGATES

Jeder Arbeitspunkt benötigt die jeweils relevanten Tests.

Pflichtbasis:

```text
npm ci
Formatcheck
TypeScript
ESLint mit 0 Warnungen
Unit-Tests
Contract-Tests
Integrationstests
Route-Tests
Production Build
relevante Playwright-E2E-Tests
Datenbank-Reset
pgTAP
Security Audit
License Check
```

Für kritische Module in:

* Billing,
* Account-Löschung,
* Alerts,
* Forecasts,
* Realtime,
* Portfolio,
* Auth,
* Admin,
* Provider-Health

gilt:

* keine Datei mit 0 % Coverage,
* mindestens 90 % Line-Coverage,
* mindestens 85 % Branch-Coverage,
* zusätzlich echte Verhaltens- und Integrationstests,
* Coverage allein ersetzt keinen E2E-Nachweis.

Die Gesamtcoverage darf niemals sinken und wird schrittweise angehoben.

Mock-Tests und reale Tests werden getrennt ausgewiesen.

Ein Mock-Test ist kein Live-Test.

Ein Stripe-Normalisierungstest ist kein Billing-Lifecycle-Test.

Ein Supabase-RLS-Unit-Test ist kein echter Auth-E2E-Test.

Ein lokaler SSE-Test ist kein Cross-Instance-Realtime-Test.

Ein `/health`-Lasttest ist kein Marktdaten-Lasttest.

---

# 8. EXTERNE BLOCKER

Zum Auditzeitpunkt bestanden unter anderem:

* fehlende oder ungeprüfte FMP-Entitlements,
* Twelve-Data-Key, Tarif und Displayrechte,
* Alpaca-Konto, Plan, Keys und Display-/Redistributionsrechte,
* globale Börsen- und Datenrechte,
* echte Upstash-/Redis-Produktionskonfiguration,
* Stripe-Live-Produkte, Webhooks und Lifecycle-Abnahme,
* Supabase-Leaked-Password-Protection beziehungsweise notwendige Konfiguration,
* Apple Developer Signing und TestFlight,
* rechtlich geprüfte Texte,
* Supportorganisation,
* zeitweises Vercel-Build-Limit.

Regel:

Ein externer Blocker entschuldigt keine intern lösbare Lücke.

Beispiel:

Fehlende Alpaca-Keys verhindern einen echten Live-Smoke, aber nicht:

* den Realtime-Hub,
* Quote-/Trade-Trennung,
* Sequence-Gap-Tests,
* Backpressure,
* Reconnect,
* Liveness,
* Integrationstests mit realistischem Provider-Harness.

Eine Phase darf nur dann als:

```text
TECHNICALLY COMPLETE – BLOCKED EXTERNAL
```

bezeichnet werden, wenn sämtliche intern lösbaren Implementierungs-, Test-, CI-, Security- und Dokumentationsaufgaben abgeschlossen sind.

Sie ist dadurch nicht „produktionsaktiv“ oder „live verifiziert“.

---

# 9. NEUER VERBINDLICHER PHASENPLAN

## PHASE 0 – Wahrheit und Governance

* aktuellen Repo-/PR-/CI-/Production-Stand erfassen,
* gestapelte PRs einfrieren,
* Arbeitsbaum und Branchbasis prüfen,
* Operating Card und Ledger aktualisieren,
* alle bekannten P0/P1-Funde aufnehmen,
* technische und externe Blocker trennen.

## PHASE 1 – Billing- und Account-Stabilisierung

Reihenfolge:

1. Stripe-sichere Account-Löschung,
2. Free-/Pro-/Premium-Limits,
3. Payment-Recovery und Doppelabo-Schutz,
4. atomare/out-of-order-sichere Webhooks,
5. vollständige Stripe-Testmode-E2E-Kette.

Keine Paid-Aktivierung vor Abschluss.

## PHASE 2 – Kanonische Listing-Identität

`canonicalId`, Listing, Venue und Währung durch sämtliche produktiven Grenzen führen.

## PHASE 3 – Realtime-Hub

Zentraler Fanout, Liveness, Quote-/Trade-Trennung, Backpressure, Sequence und Recovery.

## PHASE 4 – Alert-Engine

Semantik, Scheduler, Pagination, Cooldown, Idempotenz, Datenqualitätsgate und Delivery.

## PHASE 5 – Forecast-Integrität

Due-Time-Historie, Modell-/Version-/Horizon-Trennung, Concurrency und ehrlicher Track Record.

## PHASE 6 – Portfolio, Backtest und Analysen

Mark-to-Market, FX, Cloud-Portfolios, Backtest-Auth und evidence-bound Analyse.

## PHASE 7 – Shared Cache, Resilience und Operations

Redis-Wahrheit, atomare Limits, Cross-Instance-Coalescing, Health, Monitoring und Lasttests.

## PHASE 8 – Security, CI und Deployment

Workflow-Härtung, Env-Vertrag, zentrale Provider-Fetch-Policy, DB-gekoppeltes Deployment und kritische Tests.

## PHASE 9 – Produktwahrheit, PWA, Mobile und Accessibility

Watchlist, Offline, iPhone/Android, Landscape, WCAG, Support und GDPR-Export.

## PHASE 10 – Bestehende Provider neu abnehmen

FMP, Twelve Data und Alpaca gegen die nun korrigierte Kernarchitektur erneut vollständig prüfen.

Phase 7 beziehungsweise Alpaca darf erst danach neu als abgeschlossen bewertet werden.

## PHASE 11 – Finnhub

## PHASE 12 – SEC EDGAR

## PHASE 13 – FRED

## PHASE 14 – ECB

## PHASE 15 – CoinGecko

## PHASE 16 – Coinbase Streaming

## PHASE 17 – Binance Streaming

## PHASE 18 – Cross-Provider Data Quality

## PHASE 19 – Instrument Search und Mapping

## PHASE 20 – Charts und Market Sessions

## PHASE 21 – Fundamentals und Earnings

## PHASE 22 – Filings und News Intelligence

## PHASE 23 – Technical und Macro Analysis

## PHASE 24 – Risk Engine, Szenarien und erklärbare Scores

## PHASE 25 – Watchlists und Alerts final

## PHASE 26 – Portfoliofunktionen final

## PHASE 27 – UI-/UX-Gesamtreview

## PHASE 28 – Mobile-/PWA-Gesamtabnahme

## PHASE 29 – Subscription-/Stripe-Gesamtabnahme

## PHASE 30 – Security Audit

## PHASE 31 – Performance Audit

## PHASE 32 – Red Team

## PHASE 33 – Lizenz- und Produktionsprovider-Abnahme

## PHASE 34 – Marktreife-Gesamttest

Keine dieser Phasen darf begonnen werden, solange die vorherige Phase nicht vollständig abgeschlossen oder ausschließlich extern blockiert ist.

---

# 10. DEFINITION OF DONE PRO ARBEITSPUNKT

Ein Arbeitspunkt ist erst fertig, wenn alles Folgende belegt ist:

* Ursache verstanden,
* vollständige Implementierung,
* Datenmigration vorhanden,
* Rückwärtskompatibilität geprüft,
* Formatcheck grün,
* Typecheck grün,
* Lint grün,
* Unit-Tests grün,
* Contract-Tests grün,
* Integrationstests grün,
* relevante Route-Tests grün,
* relevante pgTAP-Tests grün,
* relevante E2E-Tests grün,
* Production Build grün,
* Security-Auswirkungen geprüft,
* Datenkorrektheit geprüft,
* Mobile/Desktop geprüft,
* Regressionen geprüft,
* Dokumentation aktuell,
* Commit erstellt,
* Branch gepusht,
* Pull Request aktuell,
* CI vollständig grün,
* Datenbank-CI vollständig grün,
* Preview geprüft,
* auf `main` gemergt,
* Stockpilot-Deployment erfolgreich,
* reale Funktion oder realistische Sandbox geprüft,
* Logs geprüft,
* Monitoring geprüft,
* Evidence gespeichert,
* Operating Card und Ledger aktualisiert.

Fehlt ein Punkt, bleibt der Arbeitspunkt offen.

---

# 11. DEFINITION OF DONE GESAMTPROJEKT

Stockpilot ist erst marktreif, wenn:

* keine bekannten P0- oder P1-Fehler bestehen,
* Account-Löschung und Billing sicher funktionieren,
* kein Doppelabo möglich ist,
* Planlimits korrekt sind,
* Stripe-Lifecycle vollständig getestet ist,
* reale Provider funktionieren,
* Instrumente listinggenau aufgelöst werden,
* keine falschen Währungen oder Listings entstehen,
* Realtime zentral skaliert,
* Upstream-Liveness ehrlich dargestellt wird,
* Alerts korrekt und spamfrei sind,
* Forecast-Track-Record fachlich belastbar ist,
* Portfolio-Mark-to-Market korrekt ist,
* Analysen evidence-bound und erklärbar sind,
* Mockdaten niemals als Produktion erscheinen,
* Datenqualität und Freshness sichtbar sind,
* Auth und Mandantentrennung geprüft sind,
* kritische Routen ausreichend getestet sind,
* Mobile und Desktop stabil sind,
* PWA und Offline deterministisch funktionieren,
* Accessibility geprüft ist,
* Shared Cache und Rate Limits horizontal funktionieren,
* Security Audit bestanden ist,
* Red Team bestanden ist,
* Performance und Realtime-Last belegt sind,
* CI und Datenbank-CI grün sind,
* Production Build und Deployment geprüft sind,
* Monitoring und Alerting aktiv sind,
* rechtliche Texte freigegeben sind,
* Provider- und Börsenrechte dokumentiert sind,
* Support- und Incident-Prozess bestehen,
* Dokumentation dem realen Stand entspricht.

---

# 12. ABSCHLUSSBERICHT JE ARBEITSPUNKT

Nach jedem Arbeitspunkt berichtest du exakt:

```text
Aktive Phase:
Arbeitspunkt:
Ausgangsfehler:
Ursache:
Implementierte Lösung:
Geänderte Dateien:
Migrationen:
Neue Tests:
Ausgeführte Tests:
Exakte Testzahlen:
Coverage des kritischen Bereichs:
Build:
Security-Prüfung:
Commit:
Branch:
Pull Request:
CI-Links:
Datenbank-CI:
Preview:
Deployment:
Live-/Sandbox-Prüfung:
Logprüfung:
Technische Restpunkte:
BLOCKED – EXTERNAL:
Aktualisierte Dokumentation:
Freigabestatus:
```

Erlaubte Freigabestatus:

```text
OPEN
FAILED
TECHNICALLY COMPLETE – BLOCKED EXTERNAL
DEPLOYED – LIVE VERIFICATION PENDING
COMPLETE – VERIFIED
```

Benutze `COMPLETE – VERIFIED` nur, wenn sämtliche DoD-Punkte erfüllt sind.

---

# 13. BEGINNE JETZT

Beginne jetzt ausschließlich mit:

```text
PHASE 0 – Wahrheit und Governance
```

Danach bearbeitest du als ersten technischen Arbeitspunkt:

```text
PHASE 1.1 – Stripe-sichere Account-Löschung
```

Arbeite nicht an Finnhub, SEC, FRED, ECB, CoinGecko, Coinbase, Binance oder weiteren Features weiter, bevor die Stabilisierung abgeschlossen ist.

Keine unnötigen Rückfragen.

Frage nur, wenn:

* eine echte externe Entscheidung benötigt wird,
* Produktionszugang fehlt,
* eine destruktive Aktion ausdrücklich bestätigt werden muss,
* rechtliche oder finanzielle Autorität des Eigentümers erforderlich ist.

Ansonsten:

Analysieren, implementieren, testen, pushen, CI prüfen, deployen, real verifizieren, dokumentieren und erst danach den nächsten einzelnen Punkt beginnen.

Stockpilot soll nicht möglichst viele halbfertige Funktionen besitzen.

Stockpilot soll verlässlich, sicher, ehrlich, schnell, verständlich und tatsächlich nützlich werden.
