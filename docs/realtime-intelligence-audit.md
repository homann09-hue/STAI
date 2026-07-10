# Realtime Intelligence Audit

Stand: 10. Juli 2026

## Ist-Zustand vor dieser Etappe

- Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS und PWA/Capacitor.
- Supabase wird serverseitig für Auth-Prüfung, Watchlists, Portfolio, Alerts, Benachrichtigungen und Entitlements verwendet.
- Finanzdaten sind über normalisierte Provider für FMP, Finnhub, Twelve Data, EODHD, Massive/Polygon, Alpha Vantage, Binance und Coinbase vorbereitet.
- News kamen bislang über Marketaux, NewsAPI oder klar markierte Mock-Daten. FMP war für Fundamentals und Kurse vorhanden, aber nicht als Intelligence-Quelle.
- Der bestehende KI-Provider liefert derzeit ausschließlich klar markierte Mock-Analysen. Es gab keine persistente, quellengebundene Ereignisanalyse.
- API-Routen besitzen zentrale Rate Limits, sichere JSON-Header, Eingabevalidierung und redigierte strukturierte Logs.
- Supabase-Migrationen besitzen nutzerbezogene RLS-Policies mit `(select auth.uid()) = user_id`.
- Ein täglicher Vercel-Cronjob existiert für den getrennten Alert-Worker. Eine Intelligence-Ingestion war nicht vorhanden.

## Architekturkonflikte und Risiken

1. `NewsItem` war ein UI-Modell, kein unveränderlicher Rohbeleg. Quelleninhalt, Normalisierung, Analyse und Score waren nicht getrennt.
2. Fallback auf Mock-News ist für Produktdemos sinnvoll, darf aber nie in einer Research-Pipeline persistiert oder als echtes Ereignis bewertet werden.
3. Der bestehende Alert-Worker verwendet absichtlich keine echten Providerwerte. Intelligence-Alerts benötigen einen eigenen, beleggebundenen Pfad.
4. Ein globaler Feed über direkte Client-Tabellenzugriffe würde Rohpayloads und lizenzpflichtige Inhalte exponieren. Deshalb liest die UI nur serverseitig über eine reduzierte View.
5. Der Service-Client umgeht RLS. Alle nutzerbezogenen Schreiboperationen müssen daher weiterhin serverseitig aus einer verifizierten Session oder einer deterministischen Watchlist-Regel abgeleitet werden.
6. In-Memory-Caches und Circuit Breaker sind auf Vercel instanzlokal. Horizontale Koordination benötigt später Redis/Queue-Infrastruktur.
7. Es gibt keine zentrale Unternehmensstammdatentabelle. Die erste Etappe nutzt stabile IDs wie `cik:<CIK>` oder `symbol:<Ticker>` und speichert Zuordnungskonfidenz.

## Ergebnis dieser Etappe

- Neue ereignisgesteuerte Intelligence-Domain mit Adaptervertrag, Rohdaten, Normalisierung, Entity Resolution, Deduplizierung, Analyse, Scoring, Alerting und Feed.
- FMP Stock News und SEC EDGAR Submissions als erste reale Adapter.
- Striktes Analyse-Schema, deterministischer Offline-Analyzer und optionale OpenAI-kompatible/vLLM-Schnittstelle.
- Neue Supabase-Migration mit RLS, Indizes, Retention und serverseitiger Feed-View.
- Geschützte Ingestion sowie öffentliche, bereinigte Feed- und Detail-Endpunkte.
- Mobile Intelligence-Ansicht mit Quellenlink, Latenz, Bestätigung, Fakten, Unsicherheiten und Score-Aufschlüsselung.

## Bewusst nicht vorgetäuscht

- Kein globales Echtzeitversprechen: FMP und SEC werden als `near_real_time` beziehungsweise providerabhängig dargestellt.
- Keine KI-Modellanalyse ohne konfigurierten Anbieter. Standard ist eine transparente regelbasierte Auswertung.
- Keine automatische Marktreaktion ohne zeitlich korrekte Intraday-Daten.
- Keine Social-Media-Ingestion ohne offizielle OAuth-API und genehmigte Nutzungsbedingungen.
- Keine produktive Alert-Zustellung per Push/E-Mail; interne Alerts werden zunächst mit Status `pending` gespeichert.
