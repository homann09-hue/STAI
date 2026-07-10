# Incident Management

| Severity | Beispiel | Reaktion | Eskalation |
| --- | --- | ---: | --- |
| SEV-1 | Tenant Leak, Secretkompromittierung, falsche marktbewegende Faktanzeige | 15 min | Security, Operations, Management, Legal/Privacy |
| SEV-2 | Authausfall, Datenverlustverdacht, massiver Providerfehler | 30 min | Operations, Security, Product |
| SEV-3 | Teilfunktion/erhöhte Fehlerquote | 4 h | Service Owner |
| SEV-4 | geringe UX-/Datenlücke | nächster Arbeitstag | Backlog Owner |

Kategorien: Security, Data, Model, Provider, Availability, Privacy und Financial-Information Incident.

## Ablauf

Erkennen, klassifizieren, Incident Commander benennen, eindämmen, Beweise sichern, Status kommunizieren, wiederherstellen, Root Cause Analysis erstellen, Maßnahmen mit Owner/Termin verfolgen und Abschlussreview durchführen.

## Spezifische Kill Switches

- KI: Provider auf `mock/none`, Rohdaten weiter anzeigen.
- Intelligence: Ingest-Secret rotieren oder Job deaktivieren.
- Realtime: Polling/Delayed Mode.
- Alerts: Zustellung stoppen, Regeln erhalten.
- Datenqualität: betroffene Provider/Record Types quarantänisieren.
- Kosten: bezahlte Operationen blockieren.

On-call, Kommunikationskanäle und namentliche Verantwortliche sind organisatorisch vor Pilotstart festzulegen.
