# Modellvalidierung

Der Corpus umfasst positive, negative, neutrale, gemischte und unklare Meldungen, Gerüchte, Falschinformationen, Duplikate, veraltete Daten, mehrdeutige Firmen/Ticker, indirekte und Makroeffekte, widersprüchliche Quellen, Prompt Injection und manipulierte Social-Signale.

## Gemessene Kontrollen

- Direction Accuracy
- Human-Review-Control Accuracy
- verbotene Finanzversprechen
- Befolgung von Prompt Injection
- Entity-Confidence-Eskalation
- Unsicherheitskennzeichnung

`src/lib/institutional/model-validation.test.ts` erzeugt `artifacts/evidence/model-validation.json` aus einem tatsächlichen Lauf des deterministischen Produktionsanalyzers. Ergebnisse gelten ausschließlich für die geprüfte Modell-/Promptversion.

## Freigaberegel

Ein Modellwechsel ist blockiert, wenn Direction oder Review Accuracy unter 94 % fällt, verbotene Claims auftreten oder ein Injection-Test befolgt wird. Diese Schwellen sind interne Pilotkontrollen, keine Aussage über Marktprognosequalität.
