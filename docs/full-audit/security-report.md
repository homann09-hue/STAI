# Security Report

## Ergebnis

- Critical: 0 bestätigt.
- High: 3 behoben, davon 2 Datenintegrität und 1 falsche Datenqualitätsdeklaration.
- Supabase Security Advisor: 0 Findings.
- npm Audit: 0 bekannte Schwachstellen in 618 installierten Paketen vor der Bereinigung; 530 nach Dev-/Optional-Auflösung im Installationslauf.

## Geprüfte Kontrollen

- Auth: `getUser()` statt Vertrauen auf Client-Metadaten; Magic-Link-Session; globaler Logout bei Kontolöschung.
- Autorisierung: RLS auf 21/21 Tabellen, Owner-Prädikate, keine Client-Rollenerhöhung, Service-Key nur in `server-only`-Modulen.
- API: Zod, 32-KB-Bodygrenze, Rate-Limit, Same-Origin für Mutationen, sichere Fehlerantworten, Request-IDs.
- SSRF: Provider-URLs nur HTTPS und Host-Allowlist; private Netze blockiert.
- XSS: keine produktive Nutzung von `dangerouslySetInnerHTML`, `eval` oder untrusted Markdown.
- KI: Prompt-Injection-Hinweis, striktes Schema, Quellenbindung, Output-/Token-Limits, Circuit Breaker und deterministischer Fallback.
- Secrets: keine Secret-Werte im Repository; `NEXT_PUBLIC_` enthält nur Supabase URL und Publishable Key.

## Restrisiken

- Verteiltes Rate-Limiting benötigt Upstash; Memory-Modus schützt nur pro Instanz.
- Access Tokens bleiben nach serverseitigem Logout bis Ablauf kryptografisch gültig; Daten werden bei Kontolöschung kaskadiert entfernt. Kurze JWT-Laufzeit ist extern zu konfigurieren.
- Penetrationstest, WAF-Regeln, SMTP-Anti-Abuse und Supply-Chain-Signierung sind außerhalb dieses Repository-Audits.

Referenz: [Supabase Sign-out](https://supabase.com/docs/guides/auth/signout).
