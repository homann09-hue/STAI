# Database and Supabase Report

## Inventar

- 21 Public-Tabellen, alle mit RLS.
- 1 Public-View `intelligence_feed` mit `security_invoker=true` und nur Service-Role-Zugriff.
- Funktionen: `set_updated_at`, `apply_portfolio_trade`, `private.purge_expired_intelligence_events`.
- Keine Storage-Buckets und keine Edge Functions im Projekt.

## Verifikation

- Security Advisor: keine Findings.
- Performance Advisor: ausschließlich `unused_index`-Infos bei geringer Datenbanknutzung; Indizes wurden nicht voreilig entfernt.
- Aggregierte Produktionsprüfung: keine negativen/Null-Positionen, Duplikate oder Owner-Mismatches vor Migration.

## Änderungen

- Atomare Trade-RPC mit Advisory Lock und Überverkaufsprüfung.
- Unique-Indizes für Standard- und Buchpositionen.
- Composite-FKs erzwingen identische `user_id` für Portfolio, Position und Transaktion.
- Führende Composite-Indizes decken alle neuen Owner-Foreign-Keys ab.
- Triggerhelper nicht mehr für `anon`/`authenticated` ausführbar.
- pgTAP prüft RLS, Isolation, Funktionsrechte, Unique-Indizes und Rollback eines Überverkaufs.

## Betrieb

- Migrationen sind kanonisch; `schema.sql` ist nur Baseline.
- Lokale pgTAP-Ausführung benötigt Docker/Supabase-Stack; GitHub Workflow führt sie isoliert aus.
- Retention-Purge ist Service-Role-only, muss aber organisatorisch geplant und überwacht werden.
