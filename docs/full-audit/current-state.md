# STAI Current State

Stand: 10. Juli 2026. Technischer Audit, keine Rechtsberatung.

## Systemübersicht

- Next.js 16 App Router, React 19, TypeScript 5.9, Tailwind CSS 3, Node `>=22 <25`, npm-Lockfile.
- 160 TypeScript-/TSX-Dateien und rund 28.300 Quellcodezeilen.
- 27 bestehende API-Routen plus Kontoexport und Kontolöschung; alle Routen verwenden den zentralen API-Guard.
- Supabase Auth und Postgres mit 21 Public-Tabellen, RLS auf jeder Tabelle, 1 `security_invoker`-View, 3 Datenbankfunktionen und keinen Storage-Buckets.
- Vercel Functions, zwei tägliche Hobby-kompatible Cronjobs, serverseitige Provider-Keys, Memory-/Upstash-Cache.
- PWA-Service-Worker, Offline-Snapshots, SSE-Marktdatenstream, optionaler Finnhub-WebSocket und Capacitor-iOS-Shell.

## Datenflüsse und Sicherheitsgrenzen

1. Browser ruft ausschließlich StockPilot-API-Routen auf; Provider- und Service-Keys bleiben serverseitig.
2. Supabase-Token wird serverseitig mit `getUser()` validiert; Service-Role-Abfragen werden zusätzlich konsequent mit `user_id` begrenzt.
3. Markt-, News-, Fundamental- und Intelligence-Daten werden normalisiert, qualitätsmarkiert, begrenzt und gecacht.
4. Mutationen benötigen JSON-Schema, Größenlimit, Same-Origin-Prüfung und Rate-Limit.
5. Intelligence-Rohdaten und Modelle sind für `anon`/`authenticated` nicht direkt freigegeben.

## Kritische Komponenten

- `src/lib/providers/market-provider.ts`: Provider-Fallback, Quote-Normalisierung, Streams.
- `src/lib/supabase/user-data.ts`: Authentifizierte Nutzerdaten und Service-Role-Grenze.
- `src/lib/intelligence/*`: Quellen, Deduplizierung, Modellvalidierung und Scoring.
- `src/lib/api-guard.ts`: Rate-Limit, Body-Limit, CSRF- und Response-Header.
- `supabase/migrations/*`: RLS, Constraints, RPC und Retention.

## Technische Schulden und Single Points of Failure

- Providerrechte und Börsenlizenzen sind externe Vertragsabhängigkeiten.
- Upstash ist für verteiltes Rate-Limiting/Cache erforderlich; Memory-Fallback ist instanzlokal.
- Supabase ist zentrale Auth-/Datenbankabhängigkeit; PITR hängt vom gebuchten Plan ab.
- Cloud-Multiportfolio ist strukturell vorbereitet, aber Trades arbeiten derzeit bewusst im unzugeordneten Standardportfolio.
- Große Module über 900 Zeilen sollten schrittweise entlang stabiler Domänengrenzen geteilt werden, nicht per Big-Bang-Refactor.
