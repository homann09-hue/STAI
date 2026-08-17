# Blocker und offene Risiken

Stand: 2026-08-17

Dieses Dokument trennt intern lösbare Arbeit strikt von Abhängigkeiten, die
nicht durch Code allein abgeschlossen werden können.

## Intern lösbar

| Priorität | Thema | Aktueller Stand | Nächster belegbarer Schritt |
|---|---|---|---|
| P0 | Phase-0-Lieferweg | OPEN | Governance-PR vollständig prüfen, mergen, StockPilot deployen und live verifizieren |
| P1 | Stripe-safe Kontolöschung | Noch nicht als v4-Arbeitspunkt begonnen | Billing-Lifecycle A–D nach Phase 0 implementieren und testen |
| P1 | Eingefrorene PR-Kette #87–#97 | Als Entwurf eingefroren | Nach Stabilisierung einzeln bewerten und kontrolliert übernehmen |
| P1 | Stress-Nachweis | 2.000er Probe vorhanden; 500er Gate durch 256 Client-Sockets verfälscht | Korrigiertes Gate in CI ausführen und Ergebnis dokumentieren |
| P1 | Realtime-Hub, Alerts und Provider-Orchestrierung | Nicht als produktionsreif belegt | Erst nach Billing-Stabilisierung als einzelne Arbeitspunkte umsetzen |
| P1 | Prognosen, Portfolio, Backtesting und Analyse | Teilfunktionen vorhanden, Gesamt-Reife nicht belegt | Deterministische Berechnung, Datenqualität und End-to-End-Evidenz je Punkt schließen |
| P2 | Cache, Resilienz, PWA, Barrierefreiheit und DSGVO | Teilweise vorhanden | Nach P0/P1 jeweils mit messbarer Abnahme bearbeiten |

## BLOCKED – EXTERNAL

### FMP-Instrumentuniversum und Symbolzugriff

**Nachweis:** Am 2026-08-07 lieferten Legacy-Verzeichnis-Endpunkte HTTP 403,
`stable/company-screener`, `stable/available-exchanges` und `stable/search-isin`
HTTP 402. `stable/quote` ist symbolweise freigeschaltet und nicht heuristisch
vorhersagbar.

**Auswirkung:** Ein vollständiges globales Instrumentuniversum und garantierte
Kursabdeckung dürfen mit dem aktuellen Tarif nicht behauptet werden.

**Aktivierung:** Geeigneten Provider-Tarif und Börsen-/Redistributionsrechte
vertraglich freischalten; anschließend Verzeichnis-Sync und Coverage-Evidenz
ausführen.

### Externe Anzeige- und Redistributionsrechte

**Nachweis:** Für SEC EDGAR, ECB und weitere Provider liegt im Repository kein
freigegebener Nachweis für `external_display` vor. Produktionsrouten sperren die
Anzeige deshalb fail-closed.

**Auswirkung:** Daten dürfen trotz technisch vorhandener Adapter nicht extern
als freigeschaltet dargestellt werden.

**Aktivierung:** Rechteinhaber, Lizenzumfang, erlaubte Felder, Aktualität,
Attribution und Aufbewahrung schriftlich bestätigen und in der Provider-
Governance hinterlegen.

### Produktionskonfiguration

**Nachweis:** Der Produktions-Healthcheck meldete am 2026-08-17
`adminSecretConfigured=false`.

**Auswirkung:** Geschützte Betriebsdiagnostik kann nicht vollständig verifiziert
werden; öffentliche Diagnose bleibt korrekt gesperrt.

**Aktivierung:** Secret ausschließlich im Vercel-Projekt `stockpilot-ai`
setzen, neu deployen und geschützten Diagnosepfad prüfen.

### Nicht durch Code abschließbare Freigaben

Apple-Signing, rechtlich geprüfte Texte, Support-/SLA-Zusagen sowie Stripe-
Liveprodukte und Zahlungsfreigabe benötigen Kontoinhaber-, Vertrags- oder
Rechtsfreigaben. Sie gelten nur dann als blockierend, wenn der jeweilige
Arbeitspunkt technisch vollständig ist und die konkrete externe Freigabe mit
Nachweis angefordert wurde.

## Aktuell kein belegter Blocker

Ein GitHub-API-HTTP-503 verhindert derzeit nur die erneute Abfrage der Branch-
Protection. Das ist ein offener Verifikationspunkt, aber noch kein dauerhafter
externer Blocker. BauPro ist kein Bestandteil dieses Repositories und wird nicht
verändert.
