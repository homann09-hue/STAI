# Cost Governance

## Kontrollen

- KI: Input-/Outputtoken und Responsebytes begrenzt; Semaphore verhindert unkontrollierte Parallelität.
- Provider: Cache, Batching, TTL, Backoff und sichtbare Rate-Limits.
- Realtime: nur aktive Symbole, Pollintervalle begrenzt.
- Evidence/Logs: Größenlimits und Retention.
- Budgetmodell: Dienst- und Tenant-Limit, 80-%-Warnung, 100-%-Hard-Stop.

## Offen

Live-Kostendaten pro Tenant, verbindliche Budgets, Benachrichtigungskanal und FinOps-Owner fehlen. Bis dahin dürfen bezahlte Enterprise-Funktionen nicht als vollständig kostenkontrolliert gelten.
