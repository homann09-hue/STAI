# Bestandsaufnahme nach §8

Stand: 2026-08-08 · Branch `codex/enterprise-saas-billing-20260711` · Commit `64928d4`

Alles hier ist **gemessen**, nicht geschätzt. Wo ein Befund aus einer
Textsuche stammt, steht die Suche daneben — und wo sie mich in die Irre
geführt hat, steht auch das.

## Kennzahlen

| | |
|---|---|
| Quelldateien | 263 (43.210 Zeilen) |
| Komponenten / Seiten / API-Routen | 45 / 27 / 38 |
| Migrationen / pgTAP-Suiten | 16 / 7 |
| Tests | 397 in 59 Dateien |
| Cron-Jobs | 4 (Alerts, Intelligence, Forecast-Erzeugung, Forecast-Auswertung) |
| `TODO`/`FIXME`/`HACK` | **0** |
| `any` / `@ts-ignore` | **0** |

Die letzten beiden Zeilen sind ungewöhnlich und verdienen die Erwähnung: in
43.000 Zeilen gibt es keine einzige Ausnahme vom Typsystem und keinen einzigen
zurückgelassenen Merkzettel.

---

## 1. Was funktioniert bereits gut

- **Datenehrlichkeit.** Herkunft, Zeitstempel und Qualitätsstufe hängen an
  jedem Datenpunkt und sind bis in die Oberfläche durchgezogen. Sechs
  Qualitätsstufen, Mock sichtbar getrennt.
- **Mandantentrennung.** RLS erzwingt sie in der Datenbank, nicht ein Filter im
  Anwendungscode. Gegen Produktion getestet, Advisor ohne Findings.
- **Der Prognosekreis.** Erzeugung, Auswertung gegen echte Kurse und eine naive
  Baseline, öffentliche Trefferbilanz mit Ehrlichkeitsregeln gegen
  Schönfärberei.
- **Billing-Kern.** Signaturgeprüfter, idempotenter Webhook mit
  Immutability-Trigger; Entitlements serverseitig durchgesetzt; Tagesquoten
  atomar in der Datenbank.
- **Makro.** Fünf EZB-Reihen ohne Schlüssel und ohne Tarifblocker, mit
  Datenalter je Reihe und einer Zinsstruktur, die sich bei zu weit
  auseinanderliegenden Stichtagen verweigert.
- **Datenbankdisziplin.** Jede privilegierte Funktion mit gepinntem
  `search_path` und engem Ausführungsrecht, geprüft von 7 pgTAP-Suiten.

## 2. Was funktioniert nur teilweise

- **Instrumentuniversum.** Suchgetrieben statt vollständig — der Vollabzug
  scheitert am FMP-Tarif, nicht am Code.
- **Technische Analyse.** Indikatoren vorhanden, Mehrzeitrahmen und
  Marktstruktur fehlen.
- **Fundamentalanalyse.** Basiskennzahlen ja, Segmente, Guidance und
  Schätzungsrevisionen nein.
- **Backtesting.** Oberfläche vorhanden, ohne Point-in-Time-Daten nicht
  belastbar.
- **Suche.** Command Palette mit Herkunft; ISIN-Suche am Tarif blockiert.
- **Observability.** Strukturiertes Logging ja, Dashboards und Alarme nein.

## 3. Was ist fehlerhaft

Nichts Bekanntes offen. Die Fehler dieser Arbeitsphase sind behoben und mit
Regressionstests festgehalten: die anonym erreichbaren Bezahlinhalte, der
Anmeldeweg der Paywall, ein Grammatikfehler in der Zinsbeschreibung, ein
Einheitenfehler um Faktor zehn in meinen eigenen Kostentests.

## 4. Was ist technisch unsauber

- **`market-provider.ts` mit 1.696 Zeilen.** Die größte Einzeldatei, seit
  Monaten ungeteilt.
- **Vier Komponenten über 800 Zeilen** (`alerts-view` 1.151,
  `portfolio-view` 995, `professional-data-view` 920, `asset-detail-view` 810).
- **16 von 38 API-Routen ohne `try`/`catch`.** Nicht automatisch falsch — viele
  sind reine Weiterleitungen —, aber ungeprüft.

## 5. Was fehlt

**Rechtlich, und das ist der ernsteste Fund dieser Aufnahme:**
`src/app/legal/page.tsx` hat 53 Zeilen und nennt Impressum und Datenschutz.
Eine Suche nach `Widerruf`, `AGB` und `Haftung` liefert **null Treffer**. Für
ein Abonnement, das an Verbraucher in Deutschland verkauft wird, fehlen damit
Widerrufsbelehrung und AGB. Das ist kein Code-Problem und keines, das ich lösen
kann — es gehört vor einen Anwalt.

**Produktseitig:** Adminoberfläche, Feature Flags, Gutscheine, Testphasen,
i18n, Export, Sharing, Paper Trading, Point-in-Time-Historie, Peer-Vergleich,
Bewertungsmodelle, Optionen, Filings, Insider, Short Interest.

## 6. Was ist redundant

Wenig. Von 92 Variablen in `.env.example` ist genau **eine** tot:
`YAHOO_FINANCE_API_KEY`. Eine erste, naive Textsuche meldete 22 — sie hatte
übersehen, dass viele Variablen dynamisch über ihren Namen gelesen werden. Der
Unterschied zwischen 22 und 1 ist genau der Unterschied zwischen geschätzt und
gemessen.

## 7. Was ist langsam

Ungemessen. `performance-budget.mjs` existiert und lief zuletzt mit 1.635 von
2.048 KiB. Bundle-Analyse, API-Latenzen und Renderzeiten wurden nie erhoben —
ich führe das als offen, nicht als unproblematisch.

## 8. Was ist unsicher

Kein bekannter offener Punkt. Behoben in dieser Phase: anonym erreichbare
Bezahlinhalte, ein möglicher IDOR bei den Rechnungen, Rechnungslinks ohne
Zielprüfung, 14 Dependency-Schwachstellen. Aktiv: RLS, CSP, HSTS,
SSRF-Allowlist, Rate Limits auf 31 von 32 Routen, Webhook-Signaturprüfung,
`private, no-store` auf allen gegateten Antworten.

**Nicht geprüft:** Prompt-Injection gegen die KI-Schicht, Brute-Force auf den
Magic-Link-Versand.

## 9. Was ist schlecht skalierbar

- **Rate Limit im Arbeitsspeicher**, wenn Upstash nicht konfiguriert ist. Bei
  mehreren Instanzen zählt jede für sich.
- **Kein Job-System.** Vier Cron-Jobs auf dem Vercel-Hobby-Tarif, je einer pro
  Tag. Für Alert-Auswertung in Marktnähe reicht das nicht.
- **Keine Aufbewahrungsgrenze** für `provider_usage` und `feature_usage`. Beide
  wachsen täglich; ein Aufräumjob fehlt.

## 10./11. Mock und Fake-Daten

Mock erscheint in 9 Dateien des Produktivpfads. Gemessen, wo und wie:

| Ort | Bewertung |
|---|---|
| `/api/alerts`, `/api/portfolio` ohne Anmeldung | **Sauber.** `dataQuality: "mock"`, `demo: true` und ein Satz, dass die Alerts nicht wirken |
| Provider (`market`, `news`, `ai`, `fundamentals`, `professional`) | **Sauber.** Mock nur, wenn kein Schlüssel konfiguriert ist; die Qualitätsstufe wird bis in die Oberfläche gereicht |
| **`/alerts` und `/portfolio` Seiten** | **Zu prüfen.** Beide rendern `mockAlerts` bzw. `getMockPortfolio()` serverseitig als Startwert — ein anonymer Besucher sieht Demo-Einträge, bevor irgendetwas geladen ist |

Der letzte Punkt ist derselbe Fehlertyp wie die anonym erreichbaren
Profi-Daten, nur mit Demo- statt Bezahldaten. Er verletzt §61 nicht zwingend
— die Kennzeichnung muss in der Ansicht geprüft werden — aber er gehört
angesehen.

## 12. Welche APIs sind produktiv nutzbar

| Quelle | Status |
|---|---|
| **EZB Data Portal** | Voll nutzbar, ohne Schlüssel, lizenzfrei mit Quellenangabe |
| **FMP** | Teilweise. Kurse und Suche ja; Verzeichnis, ISIN und Screener am Tarif blockiert (402/403) |
| **Stripe** | Voll implementiert, aber ohne Preis-IDs nicht buchbar |
| **Supabase** | Voll produktiv |
| Finnhub, Alpha Vantage, Twelve Data, EODHD, Polygon, Marketaux | Adapter vorhanden, ohne Schlüssel inaktiv |
| **SEC EDGAR** | Ingest-Pfad vorhanden, nie im Betrieb gemessen |

## 13. Wo entstehen Datenlücken

Vollabzug des Universums, ISIN/FIGI, Screener über das Gesamtuniversum,
Point-in-Time-Historie, Corporate Actions, Handelskalender, Optionen, Anleihen,
Analysten, Insider, Short Interest, US-Makro (bis ein FRED-Schlüssel vorliegt).

## 14. Was ist eher Show als Mehrwert

- **Backtesting.** Läuft, ist ohne Point-in-Time-Daten aber nicht belastbar.
- **Screener-Seite.** Zeigt das suchgetriebene Universum, nicht den Markt.
- **Intelligence-Bereich.** Ingest-Pfad existiert, im Betrieb nie gemessen.
- **`institutional`-Modul.** 6 Dateien, 3 Tests, erzeugt Reifegrade und
  Evidenz. Es misst die eigene Reife, nicht den Markt — Nutzen für einen
  zahlenden Anleger: keiner.

## 15. Was verhindert den kommerziellen Launch

In dieser Reihenfolge:

1. **Keine Widerrufsbelehrung und keine AGB.** Ohne sie darf in Deutschland
   kein Verbraucherabo verkauft werden. Braucht anwaltliche Prüfung.
2. **Keine Stripe-Preis-IDs.** Ohne sie ist kein Tarif buchbar — der Checkout
   ist vollständig, ihm fehlt nur der Preis.
3. **Kein Deployment.** Der letzte Produktionsstand ist vom 11. Juli; 43
   geprüfte Commits liegen davor.
4. **Magic-Link-only.** Kein Passwort, keine Registrierung als eigener Schritt,
   keine Login-Seite. Verteidigbar, aber eine bewusste Entscheidung, die
   niemand getroffen hat.
5. **Mobile nie auf einem Gerät geprüft.** 371 responsive Klassen in 39
   Komponenten deuten auf Sorgfalt hin, ersetzen aber keinen Test.
6. **Accessibility nie geprüft.** 118 `aria`-Attribute und 37 `role`-Angaben
   sind ein guter Ausgangspunkt, kein Nachweis.

Die Punkte 1 und 2 sind harte Sperren. 3 ist eine Entscheidung. 4 bis 6 sind
Risiken, die man sehenden Auges eingehen kann.

---

## Kein Rewrite nötig

Die Architektur trägt. Provider-Abstraktion, Entitlement-Kern, Datenherkunft,
Prognoseledger und Datenbankkontrollen sind an den richtigen Stellen getrennt.
Was fehlt, ist Breite und ein Deployment — nicht ein anderes Fundament.
