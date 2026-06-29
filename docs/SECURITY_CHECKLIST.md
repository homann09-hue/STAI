# Security Checklist

Status: umgesetzt als technische Basis für das Mock-MVP. Vor Produktion sind Provider-spezifische Audits noetig.

## API und Server

- Eingaben für Symbole, Alerts und Portfolio-Transaktionen werden mit `zod` validiert.
- Route Handler geben nur sanitizte Fehler mit Request-ID aus.
- Server-seitige API-Fassade schuetzt zukuenftige Provider-Keys vor Frontend-Leaks.
- Ein einfaches In-Memory Rate Limit reduziert Missbrauch im lokalen/Serverless-Kontext.
- API-Antworten setzen `X-Content-Type-Options` und `Referrer-Policy`.
- Globaler Header-Satz setzt `X-Frame-Options`, `Permissions-Policy` und CSP.
- Kein Secret liegt in `NEXT_PUBLIC_*`, ausser bewusst oeffentliche Supabase-Anon-Werte.

## Supabase

- RLS ist für `profiles`, `watchlists`, `alert_rules`, `portfolio_positions` und `analysis_snapshots` aktiv.
- Policies erlauben Nutzern nur eigene Datensaetze.
- `analysis_snapshots.user_id` ist nicht mehr nullable, damit keine fremden Analyse-Snapshots public lesbar werden.
- Indizes für Nutzer/Symbol-Zugriffe sind vorbereitet.
- Alert- und Asset-Typen sind per Check Constraints begrenzt.

## Frontend und PWA

- Sichtbarer Risiko-Hinweis beim ersten Start.
- Rechtlicher Hinweis in Header, Detailanalyse, Portfolio und KI-/Wahrscheinlichkeitsbereichen.
- Service Worker cached nur erfolgreiche GET-Antworten.
- Offline-Daten liegen lokal im Browser und duerfen nicht als sicherer Langzeitspeicher betrachtet werden.

## Noch vor Produktion erforderlich

- Provider-spezifische Rate Limits und Abuse Detection.
- Auth-Flows mit Supabase Session Handling und Server Actions.
- CSRF-Prüfung für Cookie-basierte Mutationen, falls später Cookies genutzt werden.
- Zentrale strukturierte Logs ohne personenbezogene oder finanzielle Detaildaten.
- SAST/DAST und Dependency Policy in CI.
- Moderate `next`/`postcss` Audit-Findings weiter beobachten, bis eine stabile Next-Version mit gepatchter transitiver Abhängigkeit verfuegbar ist.
