# Data-Quality-Framework

## Kontrollziel

Keine invaliden, nicht zuordenbaren, verbotenen oder zeitlich unplausiblen Daten dürfen stillschweigend in Analyse, Scoring oder Alerting gelangen.

## Pflichtfelder

`recordId`, `recordType`, Quelle, Provider, Quellenreferenz, fetched/published/effective timestamp, Latenz, Lizenzstatus, Processing-/Normalization-Version, Mapping Confidence und Korrekturstatus.

## Qualitätsdimensionen

| Dimension | Beispielregel | Reaktion |
| --- | --- | --- |
| Vollständigkeit | Quelle/Währung/Timestamp vorhanden | high/critical, Quarantäne |
| Korrektheit | Entity Confidence >= 0,5 | darunter Quarantäne |
| Aktualität | kein unerklärter Zukunftstimestamp | Quarantäne |
| Konsistenz | publishedAt nicht nach fetchedAt | Quarantäne |
| Eindeutigkeit | Content Hash/Provider ID | Deduplizierung |
| Plausibilität | Preis > 0, Volumen >= 0 | Quarantäne |
| Herkunft | HTTPS-Quelle und Lizenzstatus | Warnung oder Sperre |
| Reproduzierbarkeit | Processing-/Normalization-Version | Quarantäne bei Fehlen |

## Domänenregeln

- Quotes: positiver Preis, nichtnegatives Volumen, explizite Währung, normiertes Symbol.
- Historische Kurse: Datensatz-/Corporate-Action-Version; Split/Dividende darf nicht still korrigiert werden.
- Stammdaten: Ticker, Börse, ISIN/CIK getrennt und mit Confidence.
- News/SEC: Originalquelle, Publisher, Published/Received Time, Confirmation Status.
- KI: Input Hash, Snapshot, Modell/Prompt/Scoring-Version, Unsicherheit, Quellen.
- Social: standardmäßig unbestätigt, Human Review, keine Faktbehauptung.

## Quarantäne

`data_quality_quarantine` speichert Payload, Issues, Dimensionsscores und Status server-only. Release/Korrektur benötigt Reviewer und Grund. Die Pipeline zählt Quarantänen separat; sie erzeugen keine Analyse und keinen Alert.

## Nachweis

- `src/lib/institutional/data-quality.ts`
- `src/lib/institutional/institutional-controls.test.ts`
- `src/lib/institutional/pipeline-data-quality.test.ts`
- `supabase/migrations/20260710221030_add_institutional_governance_controls.sql`

## Restrisiken

Keine interne Regel beweist die ökonomische Wahrheit eines plausiblen Providerwertes. Cross-Provider-Reconciliation und ein DQ-Operations-Dashboard sind noch offen.
