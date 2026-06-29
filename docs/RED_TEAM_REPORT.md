# Red-Team Report

## Runde 1: Codequalitaet

Gefunden:

- MVP-Scores waren zu grob fuer professionelle Analyse.
- Detailseite zeigte zu wenig Datenqualitaet und Unsicherheit.
- Fehlergrenzen waren noch nicht explizit.

Fix:

- `ProfessionalScores`, `DataQualityReport`, `RiskEngineReport` und Tests eingefuehrt.
- `src/app/error.tsx` fuer sichere, nutzerfreundliche Fehleranzeige ergaenzt.

## Runde 2: Finanzlogik

Gefunden:

- Legacy-Gesamtscore vermischte Chance und Risiko.
- Wahrscheinlichkeiten waren nicht als eigenstaendige, unsichere Modellwerte abgesichert.
- Portfolio hatte keine Szenarioanalyse und keine Klumpenrisiko-Warnung.

Fix:

- Getrennte Gesamt-Chance und Gesamt-Risiko eingefuehrt.
- Wahrscheinlichkeitssumme wird auf 100 normalisiert und immer mit Garantie-Warnung angezeigt.
- Portfolio-Engine fuer Allokation, Diversifikation, Szenarien und Warnungen ergaenzt.

## Runde 3: Security

Gefunden:

- API-Routen nahmen Symbole und POST-Bodies ohne Schema-Validation.
- Fehlerantworten waren noch nicht zentral sanitizt.
- Supabase-Snapshots konnten nullable `user_id` haben.

Fix:

- `zod`-Validation, `api-guard`, Rate Limit und sichere JSON-Responses eingefuehrt.
- Supabase-Schema mit strengeren Constraints, RLS-Policies und Indizes verbessert.
- Security Header in `next.config.ts` gesetzt.

## Runde 4: UI/UX

Gefunden:

- Dashboard zeigte nicht klar genug, dass Daten Mock-Daten sind.
- Risiko-Warnungen waren nur allgemein sichtbar.
- Portfolio-Workflow war nur auf Eintraege ausgerichtet.

Fix:

- Datenqualitaet im Dashboard und Detail sichtbar.
- Risiko-Engine mit Belegen und Pruefhinweisen eingebaut.
- Transaktionsformular fuer Einbuchung und Reduktion erweitert.

## Runde 5: Legal/Risk

Gefunden:

- Einige Labels konnten wie Empfehlungssprache wirken.
- KI-Analyse brauchte Gegenargumente, Datenluecken und Unsicherheitsgrad.

Fix:

- Rechtliche Formulierungen geschaerft: keine Anlageberatung, keine Garantie, selbst pruefen.
- Sichtbare Wahrscheinlichkeitswarnung und Mock-Daten-Hinweis eingefuehrt.
- Analystenlabel neutralisiert zu Provider-Rating.

## Ergebnis

Das Projekt ist deutlich transparenter, defensiver und professioneller. Es bleibt ein Mock-MVP und darf ohne echte Provider, Auth-Flows und Produktions-Security-Audit nicht als reales Trading-System eingesetzt werden.
