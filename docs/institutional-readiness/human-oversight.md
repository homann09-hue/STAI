# Human Oversight

Human Review ist verpflichtend bei unbestätigten/mehrdeutigen Meldungen, Entity Confidence unter 0,9, Impact ab 85, widersprüchlichen Quellen, veralteten Daten, Model Drift sowie Social-/Rumor-Quellen.

Reviews werden append-only in `analysis_reviews` gespeichert. Originalanalysen dürfen nicht überschrieben werden. Eine Korrektur erzeugt eine neue Analyse-/Promptversion und referenziert den Vorgänger. Reviewer, Entscheidung, Zeit und Grund sind Pflichtfelder.

## Rollentrennung

Analyst und Reviewer dürfen für denselben Kontrollpfad nicht dieselbe Rolle kombinieren. Auditoren und Platform-/Security-Administratoren sind inkompatibel. Technische Regeln stehen in `src/lib/institutional/governance.ts`; organisatorische Zuweisung ist vor einem Enterprise-Pilot zu genehmigen.
