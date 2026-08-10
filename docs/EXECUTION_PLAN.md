# Execution Plan

Stand: 2026-08-10

## P0 - sichere Produktionssynchronisierung

1. Datenbankmigrationen vor der Anwendung ausrollen.
2. Security- und Performance-Advisor pruefen.
3. CI, pgTAP und Vercel-Preview als Pflichtchecks erzwingen.
4. Verifiziertes Artefakt nach Produktion promoten.
5. Health, Offline, Marktdatenqualitaet und Auth nach dem Deploy pruefen.

## P1 - echte Datenabdeckung

1. Anbieter mit lizenziertem Instrumentverzeichnis aktivieren.
2. Instrument Master idempotent und seitenweise synchronisieren.
3. Quote-Verfuegbarkeit weiterhin symbolweise messen.
4. Produktions-Mockdaten deaktivieren, sobald je Datenbereich ein belastbarer
   Provider-Fallback vorhanden ist.
5. Shared Cache und verteiltes Rate-Limiting aktivieren.

## P1 - belastbare Analyse

1. Point-in-Time-Kurse und Fundamentaldaten beschaffen.
2. Corporate Actions, Handelskalender und Delistings normalisieren.
3. Backtests gegen Survivorship-, Look-ahead- und Selection-Bias absichern.
4. Forecasts planmaessig erzeugen und gegen eine naive Baseline evaluieren.
5. Track Record erst nach ausreichender Stichprobe produktiv bewerben.

## P2 - kommerzieller Betrieb

1. Stripe-Preisobjekte und Webhook-Ereignisse produktiv aktivieren.
2. AGB, Widerruf, Datenschutz und Datenlizenzen rechtlich freigeben.
3. Support-, Incident- und SLA-Verantwortung benennen.
4. iOS signieren, auf echten Geraeten pruefen und fuer den Store vorbereiten.

## Definition of Done

- Kein ungekennzeichneter Mock-, Cache- oder Delayed-Wert.
- Keine Analyse ohne ausreichende Datenqualitaet und Provenance.
- Keine Migration nach Anwendungscode-Deployment.
- Alle Pflichtchecks gruen und ein reproduzierbares Release-Artefakt vorhanden.
- Rollback, Monitoring und verantwortliche Person dokumentiert.
