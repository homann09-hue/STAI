# Trust Boundaries

| Grenze | Untrusted-Seite | Trusted-Seite | Kontrolle | Restrisiko |
| --- | --- | --- | --- | --- |
| Browser zu API | Nutzerinput | Next API | Zod, Bodylimit, Same-Origin, Rate Limit | kompromittierter Client |
| API zu Supabase | JWT/Request | RLS/Service Layer | Sessionprüfung, service-only Keys | Fehlkonfiguration |
| Nutzer A zu Nutzer B | fremde IDs | user_id-RLS | Policies, Composite FKs, Negativtests | neue Tabelle ohne Policy |
| Provider zu Normalisierung | externe Payload | interne Modelle | Timeout, Größenlimit, Schema, DQ | fachlich plausible Falschdaten |
| Quelltext zu KI | Prompt Injection | Modelladapter | untrusted-data Prompt, Outputschema | Modellbefolgung trotz Prompt |
| Service Role zu DB | privilegierter Prozess | Server-only Tabellen | keine Clientkeys, Adminsecret, Audit | Serverkompromittierung |
| Cache | alte/fremde Daten | API-Antwort | namespaced Keys, TTL, Qualität | Memory-Cache nicht verteilt |
| CI zu Produktion | Repository/Actions | Vercel | Least privilege, manuelle Bestätigung | externe Action/Token |
| Mobile WebView | lokales Gerät | Web-App | HTTPS, keine eingebetteten Secrets | Jailbreak/Deviceverlust |
| Auditor/Support | privilegierte Rolle | Kundendaten | Rollentrennung, server-only Interfaces | organisatorische Fehlzuweisung |

## Authentifizierungsgrenzen

- Supabase-Nutzersessions gelten nur für eigene RLS-Daten.
- Admin-, Provider-Ping- und Ingest-Secrets sind getrennt.
- Reproduction Runs akzeptieren nur ein starkes Adminsecret.
- Tenant-/Rollenmutation ist nicht für den Client freigeschaltet.

## Verschlüsselungsgrenzen

TLS wird für Browser, Provider und Supabase vorausgesetzt. Verschlüsselung at rest wird von den Managed Providern bereitgestellt, ist aber vertraglich und organisatorisch zu verifizieren. Ende-zu-Ende-Feldverschlüsselung für Portfolios ist nicht implementiert.
