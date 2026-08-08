# StockPilot AI Provider Licensing Checklist

StockPilot must never display data as realtime, professional or licensed unless the provider contract and exchange permissions actually allow it.

## Required review before enterprise launch

- Confirm which asset classes are covered: stocks, ETFs, crypto, indices, forex, fundamentals and news.
- Confirm latency rights: realtime, near-realtime, delayed, end-of-day or historical only.
- Confirm redistribution rights for web, PWA, API, screenshots, exports and team accounts.
- Confirm user geography restrictions for US, EU, UK and other target markets.
- Confirm whether exchange attribution is required.
- Confirm whether bid/ask, pre-market, after-hours, analyst data, ETF holdings or fundamentals require separate licenses.
- Confirm data retention limits and caching limits.
- Confirm rate limits and overage pricing.
- Confirm incident escalation and provider SLA.
- Store the final decision outside the repo in the company contract/security workspace.

## Environment gate

Only set this after the review is complete:

```bash
STOCKPILOT_ENTERPRISE_PROVIDER_LICENSE_REVIEWED=true
```

## Product rule

If a provider is missing, rate-limited, delayed or using mock fallback, the UI must show that state clearly. Do not hide it behind premium-looking visuals.

## Technischer Vertragsstatus, 10. Juli 2026

| Quelle | Technischer Einsatz | Vor öffentlichem kommerziellem Einsatz |
| --- | --- | --- |
| SEC EDGAR | Offizielle Filings, maximal 10 Requests/s, deklarierter User-Agent | Fair-Access-Regeln und Retention regelmäßig prüfen |
| FMP | Quotes/Fundamentals je Tarif | Schriftliche Mehrnutzer-, Anzeige-, Cache- und kommerzielle Rechte erforderlich |
| Coinbase | Krypto-Marktdaten-Fallback | Market-Data-Terms beschränken Drittanzeige; schriftliche Freigabe erforderlich |
| Binance | Öffentliche Krypto-Marktdaten | Nutzungsbedingungen, regionale Verfügbarkeit und Redistributierung juristisch prüfen |
| Finnhub, Alpha Vantage, NewsAPI, Marketaux | Tarifabhängige Daten | Tarif, Attribution, Speicherung, News-Rechte und Nutzerzahl vertraglich bestätigen |

Primärquellen: [SEC Fair Access](https://www.sec.gov/about/webmaster-frequently-asked-questions), [FMP Terms](https://site.financialmodelingprep.com/terms-of-service), [Coinbase Market Data Terms](https://www.coinbase.com/legal/market_data), [Binance API Docs](https://developers.binance.com/en/docs/products/spot/rest-api).

## ECB Data Portal (Makro, seit 2026-08-08)

| Punkt | Stand |
|---|---|
| Abdeckung | Euroraum: Leitzins, HVPI-Inflation, AAA-Renditen 3M und 10J, EUR/USD |
| Zugang | Kein API-Schluessel, kein Tarif, keine Registrierung |
| Kosten | Keine |
| Lizenz | Weiterverwendung mit Quellenangabe zulaessig. Die Angabe steht an jedem Datenpunkt und im `attribution`-Feld der Antwort |
| Aktualisierung | Leitzins taeglich, Renditen an Handelstagen, HVPI monatlich |
| Host | `data-api.ecb.europa.eu`, exakt in der SSRF-Allowlist, nicht als Domain |
| Format | SDMX-CSV mit `detail=dataonly` |
| Ausfallverhalten | Eine nicht erreichbare Reihe fehlt sichtbar in `unavailableSeries`. Kein Ersatzwert, kein letzter bekannter Wert |

**Warum diese Quelle zuerst:** sie ist der erste Datenbereich der Zieldefinition,
der an keiner externen Freigabe haengt. Die Instrumentabdeckung haengt am
FMP-Tarif, Realtime an Boersenlizenzen — Makro an nichts.

**Gemessen am 2026-08-08 ueber die laufende Anwendung:** Leitzins 2,40 % (Stand
desselben Tages), 3M 2,26 %, 10J 3,1467 % (beide Stand 2026-08-06), EUR/USD
1,1535 (Stand 2026-08-07). Zinskurve normal, Spread 0,89 Prozentpunkte.

**Offener Punkt:** die HVPI-Reihe `ICP.M.U2.N.000000.4.ANR` liefert als juengste
Beobachtung 2025-12. Das System kennzeichnet sie korrekt als `outdated` und
zeigt sie nicht als aktuelle Inflationsrate. Der Serienschluessel gehoert
trotzdem geprueft — eine Inflationsrate mit sieben Monaten Rueckstand ist als
Kennzahl wertlos, auch wenn sie ehrlich beschriftet ist.
