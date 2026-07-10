# Datenfluss und Lineage

## Marktquote

```mermaid
sequenceDiagram
  participant C as Client
  participant A as Next API
  participant P as Provider
  participant K as Cache
  C->>A: Quote-Anfrage
  A->>K: Cache lookup
  alt Cache gültig
    K-->>A: NormalizedQuote + Herkunft
  else Cache miss
    A->>P: serverseitige Provideranfrage
    P-->>A: Rohantwort
    A->>A: Validierung, Normalisierung, Qualitätsstatus
    A->>K: TTL/Quality speichern
  end
  A-->>C: Preis, Provider, Qualität, Timestamp, Latenz
```

## Intelligence-Ereignis

```mermaid
flowchart TD
  S["Originalquelle"] --> R["Raw Event ID + Content Hash"]
  R --> N["Normalized Event ID + Normalization Version"]
  N --> DQ["8-dimensionale Qualitätsprüfung"]
  DQ -->|ungültig| Q["Quarantine + Audit Event"]
  DQ -->|verwendbar| A["Analysis ID + Input Snapshot"]
  A --> SC["Scoring Version"]
  A --> O["Anzeige mit Quelle/Unsicherheit"]
  A --> RR["Reproduction Run"]
  RR --> DF["Exact oder dokumentierter Drift"]
```

## Pflichtmetadaten

Quelle, Provider, Original-/Abruf-/Effektivzeit, Latenz, Lizenzstatus, Content Hash, Verarbeitungs- und Normalisierungsversion, Modell/Prompt/Scoring-Version, Validierungsstatus und Korrekturstatus.

## Löschung und Retention

Raw Intelligence besitzt standardmäßig 90 Tage Retention. Analysen und Auditnachweise sind append-only; rechtliche Löschung oder Vertragsende benötigt einen kontrollierten, protokollierten Migrationsprozess. Evidence Packs enthalten keine Produktionspayloads.
