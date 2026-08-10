# Model Inventory

| Modell | Version | Zweck | Input | Output | Fallback | Kill Switch | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| deterministic-intelligence-rules | 1.0.0 | konservative Eventklassifikation | normalisiertes Event | strukturierte Analyse | nicht erforderlich | Intelligence Ingest deaktivieren | getestet, Pilot |
| StockPilot Evidence Analysis | stockpilot-evidence-analysis-v1 | deterministische Asset-Einordnung | verifizierte OHLCV-Historie, externe News und Datenqualität | Chancen, Risiken, Szenarien und konservative Wahrscheinlichkeiten | Analyse blockiert | `STOCKPILOT_AI_PROVIDER=evidence` | getestet, produktiver Standard |
| Market scoring | impact-score/1.0.0 | Impact und Richtung | Fakten/Confidence | 0-100 Komponenten | kein Alert | Alertworker deaktivieren | getestet, intern |
| Asset AI summary | providerabhängig | Chancen/Risiken | Quotes, News, Fundamentals | Schätzung | deterministische Mockanalyse | Provider auf mock/none | Demo/degraded |

## Pflichtkontrollen

- Eigentümer: Product/Model Risk muss organisatorisch benannt werden.
- Modellwechsel: neuer Inventory-Eintrag und Regressionstest.
- Promptwechsel: unveränderliche Promptversion mit Hash und Freigabe.
- Verbotene Nutzung: autonome Orders, garantierte Prognosen, ungeprüfte Faktbehauptungen.
- Monitoring: Schemafehler, Drift, Human-Review-Rate, Kosten, Latenz, Halluzinations-/Zitierbefunde.
- Review-Zyklus: maximal 90 Tage im Pilot, zusätzlich ereignisgetrieben.

## Bekannte Grenzen

Deterministische Keywords verstehen Kontext nur eingeschränkt. LLM-Ausgaben können trotz Schema falsch sein. Ein hoher Score ist weder Eintrittswahrscheinlichkeit noch Anlageempfehlung.
