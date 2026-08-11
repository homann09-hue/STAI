# Security Checklist

Stand: 2026-08-11

Status: Technische Kernkontrollen sind implementiert und werden in CI geprüft.
Verbleibende Risiken und externe Konfigurationen werden nicht als erledigt
ausgegeben.

## API und Server

- Alle API-Routen nutzen zentrale Rate-Limits; der signaturgeprüfte Stripe-Webhook ist die dokumentierte Ausnahme.
- Mutierende Browserrouten prüfen Same-Origin und validieren Eingaben mit `zod`.
- Providerzugriffe laufen ausschließlich serverseitig über HTTPS-Allowlist, Timeout und Body-Limit.
- Fehlerantworten enthalten keine Stacktraces oder Secrets.
- Bezahlfunktionen und Kontingente werden serverseitig, fail-closed durchgesetzt.
- Admin-, Cron-, Provider-Ping- und Reproduction-Routen verlangen getrennte privilegierte Secrets oder verifizierte Adminrechte.
- Strukturierte Logs dürfen keine Tokens, Provider-Secrets oder Portfoliodetails enthalten.

## Supabase und Mandantentrennung

- RLS ist auf allen exponierten Nutzertabellen aktiv und wird mit pgTAP geprüft.
- Standardzugriffe auf Nutzerdaten verwenden den tokengebundenen Client.
- Service Role bleibt auf dokumentierte Server-, Worker-, Webhook- und Adminpfade begrenzt.
- Die Quotentabelle ist für Nutzer nur lesbar; direkte Inserts, Updates und Deletes sind entzogen.
- `consume_feature_quota(text, integer)` leitet den Eigentümer aus `auth.uid()` ab und akzeptiert keine Nutzer-ID.
- Anonyme und Service-Role-Aufrufe der Nutzer-Quota-RPC sind entzogen.
- SECURITY-DEFINER-Funktionen setzen einen festen `search_path` und besitzen explizite EXECUTE-Rechte.
- Datenbankmigrationen und Policies werden in GitHub-CI gegen eine echte lokale Supabase-Instanz getestet.

## Frontend, Auth und PWA

- Im Browser liegen nur Supabase-Publishable-Werte; Service-, Stripe- und Provider-Secrets bleiben serverseitig.
- Auth-Zustände laufen über Supabase-Sessions und verifizierte Bearer-Tokens.
- React-Escaping, CSP, Frame-Schutz, Referrer-Policy und MIME-Sniffing-Schutz sind aktiv.
- Der Service Worker cached nur erfolgreiche GET-Antworten.
- Offline-Daten sind lokaler Komfortspeicher und werden nicht als sicherer Langzeitspeicher dargestellt.
- Risiko- und Datenqualitätshinweise bleiben sichtbar.

## Aktuell offen

- Supabase Security Advisor meldet `auth_leaked_password_protection`: Schutz gegen bekannte geleakte Passwörter ist deaktiviert.
- Der konfigurierte Mindestwert von sechs Passwortzeichen liegt unter der Supabase-Empfehlung von mindestens acht.
- Verteilter Rate-Limit- und Provider-Cache fehlt; In-Memory-Schutz ist nicht multi-instanzfest.
- Vollständige Display-, Realtime- und Redistributionsrechte sind extern nicht abgeschlossen.
- CAPTCHA, MFA-Produktflow und formale DAST-Abdeckung sind noch nicht vollständig umgesetzt.

## Produktionsnachweis vom 2026-08-11

- [x] Quotenverbrauch verwendet den RLS-gebundenen Nutzer-Client statt Service Role.
- [x] Die Datenbank leitet die Nutzer-ID ausschließlich aus auth.uid() ab.
- [x] Die alte RPC mit frei übergebbarer UUID ist entfernt.
- [x] anon und service_role besitzen kein EXECUTE; authenticated besitzt nur EXECUTE auf der eng begrenzten RPC.
- [x] search_path ist leer und alle Objekte sind schemaqualifiziert.
- [x] 29 pgTAP-Assertions liefen im isolierten GitHub-Datenbankworkflow erfolgreich.
- [x] Main-CI, Produktions-Build, Live-Smoke und Vercel-Fehlerprüfung sind grün.
- [ ] Supabase Leaked-Password-Protection aktivieren; extern und tarifabhängig, siehe BLOCKER-012.

Akzeptierter Linter-Hinweis: Supabase warnt allgemein vor einer durch authenticated ausführbaren SECURITY-DEFINER-Funktion. Für consume_feature_quota ist diese Ausführbarkeit beabsichtigt, weil direkte Tabellen-Schreibrechte die Quotenintegrität schwächen würden. Die RPC besitzt keine wählbare Nutzer-ID, arbeitet nur auf auth.uid(), akzeptiert nur zwei feste Features und ist mit atomaren Tenant-Isolationstests abgesichert.
