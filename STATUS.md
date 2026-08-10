# StockPilot AI Status

Letzte Aktualisierung: 2026-08-10

## Aktueller Meilenstein

Der Enterprise-/SaaS-Branch ist mit `main` synchronisiert. Der aktuelle
Meilenstein schliesst produktionskritische Betriebs- und Datenbankluecken,
ohne externe Marktdaten- oder Lizenzgrenzen zu kaschieren.

## Aktuell umgesetzt

- Admin-, Konto-, Tarif-, Kosten- und Entitlement-Funktionen in PR #25.
- Transparente Datenqualitaet mit Provider, Zeitstempel, Latenz und
  Analysefreigabe.
- RLS-gebundene Nutzerdaten; Service Role nur auf dokumentierten Serverpfaden.
- Probabilistischer Forecast-Ledger mit Baseline und Outcome-Evaluation.
- Instrument Master mit gemessener statt geratener Kursverfuegbarkeit.
- CI fuer Typecheck, Lint, Coverage, Build, E2E, Performance, Security,
  Lizenzen, Evidenz und Datenbankkontrollen.
- Woechentlicher Red-Team-Lauf und halbstuendliches Live-Monitoring.
- Fest auf Commit-SHAs gepinnte GitHub Actions.
- Supabase-Advisor-Fixes fuer RLS-InitPlan, Fremdschluessel-Indizes und den
  technischen Primaerschluessel von `provider_usage`.

## Produktionsstand

- Produktionsadresse: https://stockpilot-ai-beta.vercel.app
- Aktueller Entwicklungs-PR: https://github.com/homann09-hue/STAI/pull/25
- Die Produktion darf erst nach Anwendung aller ausstehenden Migrationen und
  erfolgreichem PR-/Deployment-Gate aktualisiert werden.
- `MOCK`, `DELAYED`, `CACHED`, `OFFLINE` und `UNAVAILABLE` bleiben sichtbar;
  es gibt keinen stillen Mock-as-Live-Fallback.

## Externe Grenzen

- Der aktive FMP-Tarif liefert kein vollstaendiges Instrumentverzeichnis und
  sperrt einzelne Symbole ohne ableitbare Regel.
- Globale Realtime-Daten benoetigen passende Anbieter- und Boersenlizenzen.
- Shared Cache/Rate-Limiting benoetigt eine konfigurierte Upstash-/Redis-
  Instanz.
- App-Store-Release benoetigt Apple-Developer-Zugang und Signierung.
- Ein kommerzieller Start in Deutschland benoetigt rechtlich gepruefte AGB,
  Widerrufsbelehrung und Datenlizenzfreigaben.

## Naechster Freigabeschritt

1. Ausstehende Supabase-Migrationen anwenden und Advisors pruefen.
2. GitHub- und Vercel-Secrets/Schutzregeln aktivieren.
3. PR #25 nur bei gruenen Pflichtchecks mergen.
4. Produktionsdeployment aus dem verifizierten Artefakt ausloesen.
5. Live-Monitoring und Kernseiten nach dem Deployment pruefen.
