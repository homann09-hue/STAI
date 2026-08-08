# Datenquellen — Bestand und Eigenschaften

Stand: 2026-08-08 · gemessen am Code, nicht aus Anbieterprospekten übernommen

§21 verlangt für jede Quelle neun Angaben. Diese Datei liefert sie — und sagt
dort, wo eine Angabe **nicht gemessen** ist, genau das, statt eine plausible
Zahl einzusetzen.

## Was tatsächlich implementiert ist

Die harte Grenze ist die SSRF-Allowlist in `src/lib/providers/http-json.ts`:
was dort nicht steht, kann die Anwendung nicht erreichen — unabhängig davon,
was im Code sonst vorbereitet ist.

| Quelle | Adapter | Schlüssel nötig | Im Code referenziert |
|---|---|---|---|
| Financial Modeling Prep | ✅ | ja | 35× |
| Finnhub | ✅ | ja | 17× |
| Alpha Vantage | ✅ | ja | 14× |
| Twelve Data | ✅ | ja | 12× |
| Marketaux | ✅ | ja | 12× |
| Binance | ✅ | nein | 11× |
| Coinbase | ✅ | nein | 10× |
| NewsAPI | ✅ | ja | 9× |
| Massive | ✅ | ja | 8× |
| EODHD | ✅ | ja | 8× |
| SEC EDGAR | ✅ | User-Agent | 6× |
| Polygon | ✅ | ja | 6× |
| Databento | ✅ | ja | 3× |
| **ECB Data Portal** | ✅ | **nein** | Makro |

**Aus dem Masterprompt noch nicht angebunden:** FRED, CoinGecko, Reddit.
FRED braucht einen kostenlosen Schlüssel, CoinGecko und Reddit sind nicht
begonnen.

## Eigenschaften je Quelle

Qualitätsstufen stammen aus `.env.example` und sind die **Obergrenze**, mit der
eine Quelle auftreten darf — nicht eine Messung des Einzelabrufs.

| Quelle | Märkte | Qualitätsstufe | Realtime | Kosten | Historie | Lizenz |
|---|---|---|---|---|---|---|
| **ECB** | Euroraum-Makro | aktuell/verzögert je Reihe, **gemessen** | n/a | keine | jahrzehntelang | Weiterverwendung mit Quellenangabe |
| **FMP** | global, Aktien/ETF/Krypto/Forex | `delayed` | nein im aktuellen Tarif | Basic kostenlos | ungeprüft | eigene Display-Lizenz nötig |
| **Finnhub** | global | `near_realtime` | tarifabhängig | ungeprüft | ungeprüft | ungeprüft |
| **Binance / Coinbase** | Krypto | `near_realtime` | ja | keine | ungeprüft | Nutzungsbedingungen ungeprüft |
| **Twelve Data** | global | `near_realtime` | tarifabhängig | kreditbasiert | ungeprüft | ungeprüft |
| **Alpha Vantage** | global | `delayed` | nein | eng limitiert | ungeprüft | ungeprüft |
| **EODHD / Massive** | global | `delayed` | nein | ungeprüft | ungeprüft | ungeprüft |
| **Marketaux / NewsAPI** | Nachrichten | n/a | n/a | ungeprüft | ungeprüft | ungeprüft |
| **SEC EDGAR** | US-Filings | n/a | n/a | keine | vollständig | öffentlich, User-Agent verlangt |
| **Polygon / Databento** | US | ungeprüft | tarifabhängig | ungeprüft | ungeprüft | ungeprüft |

**Ungeprüft heißt ungeprüft.** Für neun von vierzehn Quellen sind Rate Limits,
Kosten, Historie und Lizenz nie gemessen worden. Sie sind ohne Schlüssel
inaktiv, sodass daraus heute kein Risiko entsteht — vor der ersten produktiven
Nutzung einer dieser Quellen muss die Zeile gefüllt werden.

## Ausfallverhalten

Das ist die Seite, die tatsächlich ausgebaut ist:

- **Circuit Breaker und Backoff** in `market-provider.ts` (8 Fundstellen)
- **Zeitlimit je Abruf** über `withDeadline`, mit definiertem Ersatzwert
- **Health-Report** mit sechs Betriebszuständen: `ready`, `degraded`,
  `configured`, `missing_key`, `license_required`, `demo`
- **Mock-Rückfall** — aber sichtbar: die Qualitätsstufe `mock` wird bis in die
  Oberfläche durchgereicht und nie als Live ausgegeben

## Primary, Secondary, Fallback

§21 verlangt eine Rangfolge. Der Ist-Zustand ist ehrlich benannt:

Es gibt eine **Kaskade je Kategorie** (Kurse, Krypto, News, Fundamentaldaten),
gesteuert über `STOCKPILOT_*_PROVIDER`, mit dem Mock als letztem Glied. Was es
**nicht** gibt, ist ein automatischer Wechsel auf eine zweite echte Quelle,
wenn die erste ausfällt — der Rückfall landet beim Mock, nicht bei Finnhub.

Das ist kein Versehen, sondern eine Folge der Schlüssellage: von den
Kursanbietern ist derzeit nur FMP konfiguriert. Eine Rangfolge zwischen einer
Quelle und sich selbst ist keine.

**Voraussetzung für echtes Failover:** mindestens zwei konfigurierte
Kursanbieter. Erst dann ist die Kaskade mehr als eine Aufzählung.

## §22 Datenqualität — was geprüft wird

`src/lib/data-quality.ts` und `asset-provenance.ts`:

| Prüfung | Vorhanden |
|---|---|
| Quelle, Abrufzeitpunkt, Marktzeitpunkt | ✅ |
| Sechs Qualitätsstufen, Mock getrennt | ✅ |
| Stale-Erkennung mit eigener TTL | ✅ |
| Fehlende Felder, Nullwerte | ✅ |
| Verzögerung sichtbar | ✅ |
| Ausreißer, Splits, Währungssprünge | ❌ |
| Doppelte Daten, Symbolformat-Konflikte | 🟡 Mehrfachlistings getrennt, Dubletten nicht |
| Zeitzonen | 🟡 Makro in UTC, Kurse ungeprüft |

## §23 Realtime — Ist-Stand

Vorhanden: Streaming-Route (`/api/market/stream`), Client-Hook, Polling mit
konfigurierbarem Intervall, mehrstufiges Caching, vier Cron-Jobs.

Die Qualitätsstufe ist überall sichtbar. Was **fehlt**, ist die feine Anzeige
aus §23 — „15 Sek. alt", „2 Min. alt", „Börse geschlossen". Der Makrobereich
zeigt Datenalter in Tagen; die Kursseite zeigt die Stufe, nicht die Sekunden.
Ein Handelskalender existiert nicht, deshalb kann „Börse geschlossen" derzeit
nicht ehrlich angezeigt werden.
