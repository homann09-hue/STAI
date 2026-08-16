# Datenquellen — Bestand und Eigenschaften

> Die verbindliche Routing- und Rechtebeschreibung steht in
> [DATA_PROVIDER_RIGHTS.md](DATA_PROVIDER_RIGHTS.md). Einzelne Adapter wählen
> sich nicht selbst; die Registry entscheidet nach Capability, Assetklasse,
> Konfiguration, Lizenz und Health.

Stand: 2026-08-12 · gemessen am Code und gegen offizielle Provider-Dokumentation

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
| Twelve Data | ✅ Quote, Batch, Suche, Historie, Marktstatus; Stream tarifgesteuert | ja | zentraler Serveradapter |
| Marketaux | ✅ | ja | 12× |
| Binance | ✅ | nein | 11× |
| Coinbase | ✅ | nein | 10× |
| NewsAPI | ✅ | ja | 9× |
| Massive | ✅ | ja | 8× |
| EODHD | ✅ | ja | 8× |
| SEC EDGAR | ✅ | User-Agent | 6× |
| Polygon | ✅ | ja | 6× |
| Databento | ✅ | ja | 3× |
| **ECB Data Portal** | ✅ | **nein** | 13 Euroraum-Reihen, SDMX-Historie/Revisionen |
| **FRED** | ✅ | optional | US-Makro, Vintage-/Revisionen mit Schlüssel |

**Aus dem Masterprompt noch nicht angebunden:** CoinGecko, Reddit.
FRED nutzt mit `FRED_API_KEY` die offizielle JSON-API einschließlich
Erstveröffentlichung und Revisionsvergleich. Ohne Schlüssel bleibt der
offizielle CSV-Export aktiv; die UI kennzeichnet dann fehlende Vintage-Daten.

## Eigenschaften je Quelle

Qualitätsstufen stammen aus `.env.example` und sind die **Obergrenze**, mit der
eine Quelle auftreten darf — nicht eine Messung des Einzelabrufs.

| Quelle | Märkte | Qualitätsstufe | Realtime | Kosten | Historie | Lizenz |
|---|---|---|---|---|---|---|
| **ECB** | Euroraum-Makro | aktuell/verzögert je Reihe, **gemessen** | n/a | keine | jahrzehntelang | Weiterverwendung mit Quellenangabe |
| **FRED** | US-Makro | aktuell/verzögert je Reihenfrequenz | n/a | API-Schlüssel kostenlos; CSV ohne Schlüssel | je Reihe | Public Domain oder Quellenangabe je Reihe; kommerzielle Einordnung offen |
| **FMP** | global, Aktien/ETF/Krypto/Forex | `delayed` | nein im aktuellen Tarif | Basic kostenlos | ungeprüft | eigene Display-Lizenz nötig |
| **Finnhub** | global | `near_realtime` | tarifabhängig | ungeprüft | ungeprüft | ungeprüft |
| **Binance / Coinbase** | Krypto | `near_realtime` | ja | keine | ungeprüft | Nutzungsbedingungen ungeprüft |
| **Twelve Data** | Aktien, ETF, Indizes, Forex, Krypto, globale Listings | höchstens `near_realtime`, Delay je Markt/Tarif offen | tarifabhängig | Basic offiziell 8 Credits/Min., 800/Tag | Intraday bis 1 Monat, 1–5000 Werte je Abruf | externe Anzeige nicht verifiziert und daher gesperrt |
| **Alpha Vantage** | global | `delayed` | nein | eng limitiert | ungeprüft | ungeprüft |
| **EODHD / Massive** | global | `delayed` | nein | ungeprüft | ungeprüft | ungeprüft |
| **Marketaux / NewsAPI** | Nachrichten | n/a | n/a | ungeprüft | ungeprüft | ungeprüft |
| **SEC EDGAR** | US-Filings | n/a | n/a | keine | vollständig | öffentlich, User-Agent verlangt |
| **Polygon / Databento** | US | ungeprüft | tarifabhängig | ungeprüft | ungeprüft | ungeprüft |

**Ungeprüft heißt ungeprüft.** Für mehrere Quellen sind Rate Limits,
Kosten, Historie und Lizenz noch nicht gemessen. Sie sind ohne Schlüssel
inaktiv, sodass daraus heute kein Risiko entsteht — vor der ersten produktiven
Nutzung einer dieser Quellen muss die Zeile gefüllt werden.

## Ausfallverhalten

Das ist die Seite, die tatsächlich ausgebaut ist:

- **Circuit Breaker und Backoff** in `market-provider.ts` (8 Fundstellen)
- **Zeitlimit je Abruf** über `withDeadline`, mit definiertem Ersatzwert
- **Health-Report** mit sechs Betriebszuständen: `ready`, `degraded`,
  `configured`, `missing_key`, `license_required`, `demo`
- **Kein stiller Mock-Rückfall** in Produktionspfaden: fehlt ein echter Kurs,
  bleibt er `unavailable`; Fixtures sind auf Entwicklung/Test begrenzt

## Primary, Secondary, Fallback

§21 verlangt eine Rangfolge. Der Ist-Zustand ist ehrlich benannt:

**Seit 2026-08-08 gebaut.** `src/lib/providers/quote-chain.ts` bildet aus den
gesetzten Schlüsseln eine Rangfolge; `ChainedQuoteProvider` fragt sie der Reihe
nach ab. Fällt die erste Quelle aus, wird die zweite versucht — erst wenn keine
antwortet, greift der Mock.

Standardrangfolge für globale Quotes: Twelve Data → Finnhub → FMP/Massive/
EODHD je Route → Alpha Vantage. Krypto-Börsen stehen bewusst separat: sie
beantworten nur Kryptosymbole und wären als allgemeiner Rückfall eine
Verschlechterung.

Eine ausdrückliche Wahl über `MARKET_DATA_PROVIDER` wird nach vorne gestellt,
schaltet den Rückfall aber **nicht** ab — wer eine Quelle bevorzugt, will damit
fast nie sagen „und sonst lieber Demodaten". Einzige Ausnahme ist `mock`: das
ist eine Ansage, keine Bevorzugung.

**Die Kette fälscht keine Qualitätsangabe.** Antwortet die zweite Quelle, trägt
der Kurs deren Namen und deren Qualitätsstufe. Ein near-realtime-Kurs von
Finnhub darf nicht als verzögerter FMP-Kurs erscheinen — und umgekehrt erst
recht nicht.

**Seit 2026-08-08 wirksam.** Finnhub ist als zweite Kursquelle konfiguriert.
Der Schlüssel wurde live gegen `finnhub.io/api/v1/quote` geprüft — AAPL
antwortete mit 313,33 USD. Die Kette meldet damit `fmp → finnhub` und
`hasFailover: true`.

Das ist der erste Zustand, in dem der Ausfall einer Kursquelle nicht zu
Demodaten führt.

**Noch offen:** der Schlüssel liegt in `.env.local` und damit nur lokal. Für
Produktion muss `FINNHUB_API_KEY` in den Vercel-Umgebungsvariablen gesetzt
werden — sonst läuft dort weiterhin nur FMP ohne Ersatz.

## Kurshistorie

Stand 2026-08-08, live gegen die Produktions-API gemessen:

| Instrument | Route | Ergebnis |
|---|---|---|
| AAPL (Aktie) | FMP `/stable/historical-price-eod/full` | **1255** Tageskerzen, 2021-08-09 bis 2026-08-07 |
| BTCUSD (Krypto) | dieselbe | **1826** Tageskerzen |
| VOO (ETF) | dieselbe | **HTTP 402** — im Tarif nicht enthalten |
| AAPL | Finnhub `/stock/candle` | **HTTP 403** — kostenpflichtige Ressource |

Daraus folgten bis Phase 5 drei Einschränkungen. Phase 6 ergänzt nun Twelve
Data als konfigurierbaren globalen Historienprovider:

1. **Historien-Failover:** Routing kann Twelve Data und FMP nach Konfiguration
   und Rechten nacheinander nutzen; Provider und Preisbasis bleiben sichtbar.
2. **Intraday:** Twelve Data unterstützt 1m, 5m, 15m, 30m, 1h und 4h. Der
   Adapter fordert UTC für Intraday an, validiert OHLCV und erfindet kein
   fehlendes Volumen.
3. **Tagesdaten:** Twelve Data wird mit `adjust=none` als rohe Preisbasis
   angefordert; FMP bleibt ein verzögerter Fallback, sofern der Tarif das
   Instrument deckt.
4. **Ohne Schlüssel/Rechte:** Produktion bleibt unverändert fail-closed. Ein
   vorbereiteter Adapter ist kein Live-Nachweis.

Zwischenspeicher: eine Stunde je Symbol. Die Antwort mit über 1000 Kerzen ist
der teuerste Abruf im gesamten Provider-Pfad, und Tagesschlusskurse ändern sich
einmal täglich.

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

### Der Ausfall ist geprueft, nicht behauptet

`src/lib/providers/quote-failover.test.ts` -- sechs Zusicherungen, die vor dem
zweiten Schluessel nicht moeglich waren, weil es nichts gab, worauf ausgewichen
werden konnte:

| Fall | Verhalten |
|---|---|
| Erste Quelle wirft | zweite antwortet |
| Erste Quelle liefert nichts | zweite antwortet (leer ist auch ein Ausfall) |
| Erste Quelle antwortet | zweite wird gar nicht erst gefragt -- sonst doppelte Kosten |
| Beide fallen aus | `null`, kein erfundener Kurs; der Aufrufer entscheidet ueber den Mock |
| Finnhub antwortet fuer FMP | Kurs traegt `Finnhub` / `near_realtime` |
| FMP antwortet fuer Finnhub | Kurs traegt `FMP` / `delayed` |

Die letzten beiden sind der Kern. Jeder Adapter stempelt Quelle und
Qualitaetsstufe auf den Kurs selbst -- die Kette reicht sie unveraendert
durch. Wuerde sie ihre eigene Kennung aufpraegen, erschiene ein
near-realtime-Kurs von Finnhub als verzoegerter FMP-Kurs. Das waere eine
Falschauskunft an genau der Stelle, an der StockPilot Ehrlichkeit verspricht.

Gegengeprueft, indem das Failover absichtlich entfernt wurde: drei der sechs
Zusicherungen wurden rot.

## Alpaca – implementiert, Produktion noch nicht aktiviert

Unterstützt werden Einzel-/Batch-Snapshots, letzte Trades, Market Clock,
historische Bars sowie Quote-/Trade-WebSockets. IEX wird als einzelner
Handelsplatz und nicht als konsolidierter US-Markt ausgewiesen;
`delayed_sip` bleibt immer delayed. Ohne Schlüssel, Vertrag und bestätigte
Anzeigerechte ist der Adapter deaktiviert. Details: `docs/ALPACA_ADAPTER.md`.


## Finnhub Phase 8: Kontroll- und Fallback-Provider (2026-08-16)

Der Adapter nutzt REST-Schluessel ausschliesslich ueber den serverseitigen Header `X-Finnhub-Token`. Der Schluessel erscheint nicht mehr in REST-URLs oder Health-Check-Logs. Der WebSocket benoetigt den Token laut Anbieterprotokoll in der Verbindungs-URL; diese URL bleibt serverseitig und darf nicht protokolliert werden.

Live gegen den aktuell konfigurierten Tarif gemessen:

| Bereich | Ergebnis | Produktstatus |
|---|---:|---|
| Quote | HTTP 200 | nutzbar, Qualitaet weiterhin symbol-/feedabhaengig |
| Symbolsuche | HTTP 200 | nutzbar |
| Unternehmensprofil | HTTP 200 | nutzbar |
| Unternehmensnews | HTTP 200 | nutzbar, Relevanz bleibt `null` wenn nicht geliefert |
| Earnings-Kalender | HTTP 200 | nutzbar |
| Analystentrends | HTTP 200 | nutzbar |
| Insider-Transaktionen | HTTP 200 | nutzbar |
| Historische Kerzen | HTTP 403 | Adapter fertig, Tarif nicht freigeschaltet |
| Kursziele | HTTP 403 | Adapter fertig, Tarif nicht freigeschaltet |
| Wirtschaftskalender | HTTP 403 | Adapter fertig, Tarif nicht freigeschaltet |
| Trade-WebSocket | Verbindung erfolgreich | serverseitig vorbereitet; keine Trades im Markt-geschlossen-Smoke-Test |

Der WebSocket wird bewusst als **Trade-Stream** modelliert. Er liefert keine vollstaendigen Bid-/Ask-Quotes und darf deshalb nicht fuer Spread-Anzeigen oder als Beleg einer Level-1-Quote verwendet werden. Fuer sichtbare Quotes bleibt Finnhub im REST-Polling. Eine Prozess-Lease verhindert mehr als eine aktive Verbindung je API-Key; Symbolzahl und Rueckstau sind hart begrenzt.
