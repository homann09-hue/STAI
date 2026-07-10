# Provider Risk Register

| Provider | Zweck/Kritikalität | Daten/Rate/Kosten | Fallback/Exit | Vertragsstatus |
| --- | --- | --- | --- | --- |
| Supabase | Auth/DB, kritisch | Nutzer-/Portfolio-/Intelligence | Export, Migration zu Postgres | Vertrag/Region/PITR prüfen |
| Vercel | Hosting/API, kritisch | App/Logs | Buildartefakt, alternative Plattform | Vertrag/SLA prüfen |
| Finnhub | Aktienquotes | planabhängig | FMP/Alpha/mock | Realtime-/Redistribution offen |
| FMP | Fundamentals/News/Quotes | kommerziell limitiert | Finnhub/Alpha | Multiuser-Anzeige schriftlich klären |
| Alpha Vantage | Fallback | stark limitiert | andere Provider | Plan prüfen |
| SEC EDGAR | Primärmeldungen | öffentlich, Fair Access | Cache/Queue | User-Agent und 10 req/s einhalten |
| NewsAPI | News | Plan/Lizenz | Marketaux/FMP | Anzeige/Archivierung prüfen |
| Marketaux | News | Plan/Lizenz | NewsAPI/FMP | Vertrag prüfen |
| Coinbase | Krypto | Exchange Terms | Binance/Cache | Redistribution/Enduser klären |
| Binance | Krypto | Public API limits | Coinbase/Cache | Jurisdiktion/Terms prüfen |
| KI-Provider | Analyse | Tokens/Datenübertragung | deterministische Regeln | DPA, Region, Training/Retention prüfen |
| Upstash | optionaler Cache | Keys/Rate | Memory degraded | noch nicht konfiguriert |

Keine zentrale Fachlogik ist absichtlich an einen einzigen Marktdatenprovider gekoppelt. Ein Ausfall von Supabase/Vercel bleibt ohne verifizierten Zweitstandort kritisch.
