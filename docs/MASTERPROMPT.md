# Masterprompt — verbindliche Zieldefinition

Dieses Dokument ist die dauerhafte Zieldefinition von StockPilot AI (STAI).
Es ist keine einmalige Aufgabenbeschreibung. Vor jeder neuen Arbeitsphase, nach
größeren Refactors und vor größeren Pushes wird der Repository-Zustand gegen
dieses Dokument geprüft. Das Ergebnis steht in `docs/PROGRESS_MATRIX.md`.

Quelle: Masterprompt des Projektinhabers vom 2026-08-08.

---

## Oberstes Ziel

Eine zentrale Plattform für umfassende Kapitalmarktanalyse — Marktanalyse,
Wertpapieranalyse, Fundamental-, Technik-, Makro-, News-, Sentiment-, Risiko-,
Portfolio-, historische und Szenarioanalyse, Prognosen und Marktüberwachung.
Nicht nur Aktien. Der Nutzer soll an einem Ort finden, was er sonst über viele
Plattformen verteilt zusammensuchen müsste.

StockPilot ist ein kommerzielles SaaS-Abonnement. Der komplette Ablauf
Registrierung → Tarifwahl → Zahlung → Freischaltung → Nutzung → Verwaltung →
Kündigung muss ohne manuellen Eingriff funktionieren.

## Absolute Grundregel

> Arbeite nicht mit dem Ziel „Ich habe möglichst viel Code geschrieben."
> Arbeite mit dem Ziel: „StockPilot ist nach jeder Arbeitsphase messbar näher an
> einem stabilen, sinnvollen, professionellen und verkaufbaren SaaS-Finanzprodukt."

## Kein falsches „fertig" (§98)

Eine Funktion ist nicht fertig, weil Code existiert, eine UI etwas anzeigt oder
eine API antwortet. Fertig heißt: implementiert, typisiert, getestet, Fehlerfälle
behandelt, Berechtigungen geprüft, Performance akzeptabel, mobil geprüft,
dokumentiert, Build erfolgreich, CI erfolgreich, GitHub aktuell.

Erst dann darf ein Punkt in der Fortschrittsmatrix **VERIFIED** heißen.

## Nicht verhandelbare Produktregeln

| Regel | Abschnitt |
|---|---|
| Keine Fake-/Demo-Daten in Produktion. Fehlt etwas: „Keine Daten verfügbar." | §61 |
| Keine Funktionsattrappen — keine Buttons ohne Funktion, keine Fake-Charts | §90 |
| Keine Scheingenauigkeit bei Prognosen. Bandbreiten statt Punktziele | §38 |
| Keine Garantieaussagen, keine „100 % Trefferquote" | §62 |
| Kein LLM als Finanzlogik. Kernlogik deterministisch/regelbasiert | §101 |
| Keine Blackbox — jede Aussage muss begründbar sein | §104, §69 |
| Datenherkunft, Stand und Verzögerung bei wichtigen Daten sichtbar | §91 |
| Der Client darf nie bestimmen, welchen Tarif ein Nutzer hat | §4 |
| Keine Secrets im Repository, keine sensitiven Keys im Client | §13, §55 |
| Keine bekannten Buildfehler auf `main` | §13 |

---

## Anforderungsblöcke

Die Nummerierung folgt dem Masterprompt und ist die Referenz für die
Fortschrittsmatrix.

### Kommerz und Zugang
- **§2 SaaS-Ablauf** — Registrierung bis Kündigung ohne manuellen Eingriff
- **§3 Tarifmodell** — FREE / PRO (~29,99 €/M) / PREMIUM (~59,99–79,99 €/M),
  je mit günstigerem Jahresabo. Zentral konfigurierbar, nicht über hunderte
  Dateien verteilt
- **§4 Entitlement-System** — zentrale Feature- und Limitverwaltung
  (`canUseAdvancedScreener`, `canUsePortfolioAnalytics`, `canUsePaperTrading`,
  `canExport`, `canUseOptionsData`, `canUseAdvancedAlerts`, `maxWatchlists`,
  `maxWatchlistItems`, `maxAlerts`, `maxSavedScreeners`, `historicalDataYears`).
  Backend und Frontend respektieren dieselben Berechtigungen
- **§5 Stripe** — Monats-/Jahresabo, Checkout, Rechnungen, Zahlungsstatus,
  Verlängerung, Kündigung, Up-/Downgrade, fehlgeschlagene Zahlungen, Portal,
  Gutscheine, Testphasen. Webhooks signaturgeprüft und idempotent.
  Status mindestens: active, trialing, past_due, canceled, unpaid, incomplete
- **§6 Billing-UX** — Bereich Account → Billing mit Tarif, Preis, nächster
  Abrechnung, Zahlungsstatus, Zahlungsmethode, Rechnungen, Upgrade, Downgrade,
  Kündigung. Fehlende Berechtigung erzeugt keine kryptische Fehlermeldung,
  sondern nennt Funktion, Tarif, Mehrwert und Upgrade-Weg
- **§7 SaaS-Wirtschaftlichkeit** — Metriken für API-Kosten, Requests pro Nutzer,
  Cache-Hit-Rate, Kosten pro aktivem Nutzer und je Tarif
- **§64 Adminbereich** — Nutzer, Abos, MRR, ARR, Conversion, fehlgeschlagene
  Zahlungen, API-Status, Jobs, Fehler, Feature Flags, System Health
- **§65 Feature Flags** — größere Funktionen kontrolliert ausrollbar

### Daten
- **§20 Marktabdeckung** — Aktien weltweit, ETFs, Indizes, Krypto, Forex,
  Rohstoffe, Anleihen, Derivate
- **§21 Provider-Architektur** — Abstraktion, Primary/Secondary/Fallback,
  je Provider dokumentiert: Märkte, Rate Limits, Kosten, Lizenz, Ausfallverhalten
- **§22 Datenqualität** — Quelle, Timestamps, Aktualität, Verzögerung,
  Qualitätsstatus. Erkennung von Lücken, Ausreißern, Split-, Währungs-,
  Zeitzonenproblemen
- **§23 Realtime** — Streaming/Polling/Caching, sichtbares Datenalter
- **§54 Datenbank** — Schema, Indizes, Constraints, Historisierung, Retention
- **§55 Supabase** — RLS, Policies, Service Role, Permissions
- **§66 Provider Health**, **§67 Data Confidence**, **§68 Forecast Confidence**

### Analyse
- **§24 Fundamentalanalyse**, **§25 Unternehmensqualität/Scores**
- **§26 Technische Analyse** (Mehrzeitrahmen), **§27 News & Events**
- **§28 Makro**, **§29 Zentralbanken**, **§30 Sentiment**
- **§31 SEC/Filings**, **§32 Insider**, **§33 Analysten**, **§34 Short Interest**
- **§35 Optionen**, **§36 Peer-Analyse**, **§37 Bewertungsmodelle**
- **§38 Szenarien/Prognosen**, **§39 Forecast-Transparenz**, **§40 Risikoanalyse**
- **§60 Finanzmathematik** — jede Berechnung überprüft
- **§70 Change Detection**, **§71 historische Reaktionen**,
  **§72 Anomaly Detection**, **§73 Market Regime**, **§74 Benchmarking**
- **§75 Dividenden**, **§76 Earnings**, **§77 Pre-/Aftermarket**
- **§107 Analyseregel** — nicht nur Zahlen zeigen, sondern beantworten: Was
  passiert? Warum? Was hat sich verändert? Wie ungewöhnlich? Welche Risiken?
- **§108/§109 vollständige Assetanalyse** und ihr Ergebnisaufbau

### Produkt und Oberfläche
- **§41 Watchlist**, **§42 Alerts**, **§43 Portfolio**
- **§44 Backtesting** (inkl. Survivorship-/Lookahead-Bias), **§45 Signalsystem**
- **§46 Market Dashboard**, **§47 Screener**, **§48 Suche**, **§49 Asset-Seiten**
- **§50 UX-Erklärungen**, **§51 Design**, **§52 Mobile/PWA**
- **§78 Zeitzonen**, **§79 i18n (de/en)**, **§80 Währungen**
- **§81 Export**, **§82 Sharing**, **§83 Workspaces**
- **§103 Paper Trading**, **§102 Trading-Bot-ready**, **§104 Strategy Engine**,
  **§105 Risk Engine**

### Technik und Betrieb
- **§53 Performance**, **§56 Security**, **§57 Fehlerbehandlung**,
  **§58 Observability**, **§59 Tests**
- **§63 DSGVO**, **§84 Codequalität**, **§85 Refactoring-Priorität**,
  **§86 Dependencies**, **§87 Edge Cases**, **§88 Red Team**
- **§92 Skalierung**, **§93 Background Jobs**
- **§99 Dokumentation**, **§100 `.env.example`**

---

## Arbeitsweise (§95, §96, §111)

Arbeitszyklus, fortlaufend zu wiederholen:

1. untersuchen → 2. Problem identifizieren → 3. priorisieren → 4. Lösung planen
→ 5. Code ändern → 6. Tests → 7. Build → 8. UI/Flow prüfen → 9. mit Masterprompt
vergleichen → 10. Commit → 11. Push → 12. CI prüfen → 13. nächste Aufgabe

Nicht zehn Bereiche gleichzeitig halb umbauen. Kein Rewrite um des Rewrites
willen. Vorhandenen Code weiterverwenden, wo er trägt.

**Rückfragen nur bei:** erheblichen externen Kosten, Löschung produktiver Daten,
irreversiblen Migrationen, externen Zugangsdaten, rechtlichen
Grundsatzentscheidungen, technisch nicht ableitbaren Entscheidungen.

## Priorisierung (§85, §94)

Korrektheit → Sicherheit → Stabilität → Datenqualität → Billing → Performance →
UX → neue Features.

Phasenreihenfolge, anpassbar an die tatsächliche Codebasis: Bestandsaufnahme →
kritische Bugs → Security → Auth & Billing → Datenqualität → Provider Layer →
Performance → Kernanalyse → Asset Pages → Screener → Watchlists/Alerts →
Portfolio → Advanced Analytics → UX/UI → Mobile/PWA → Tests → Red Team →
Production Hardening.

## Launch-Check (§110)

Vor dem Verkauf als Abo muss geprüft sein: Registrierung, Login, E-Mail-Flows,
Passwort-Reset, Stripe Checkout, Subscription Sync, Tarifberechtigungen,
Upgrade, Downgrade, Kündigung, Zahlungsfehler, Rechnungen, Account-Löschung,
Kernanalysen, Datenaktualität, keine Demo-Daten, mobile Nutzung, Error Handling,
Security Audit, DSGVO-Flows, CI grün, Production Build erfolgreich.
