# API Governance

Aktuelle interne API ist unversioniert und damit nicht für externe Enterprise-Verträge freigegeben. Externer Zugriff bleibt feature-gated.

Jede neue Enterprise-API benötigt `/api/v1`, AuthN/AuthZ, Tenantableitung aus vertrauenswürdigem Token, Schema, Rate Limit, Deadline, einheitliches Fehlerformat, Request-ID, Audit Event, OpenAPI-Dokumentation, Contract-Test und Deprecation-Fenster.

Breaking Changes erfordern neue Major-Version oder dokumentierte Migrationsphase. Service Accounts, Webhooks und kundenspezifische Limits sind nur als Interface vorzubereiten und standardmäßig deaktiviert.
