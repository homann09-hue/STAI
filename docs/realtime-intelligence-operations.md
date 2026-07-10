# Realtime Intelligence Betrieb

## Voraussetzungen

1. Supabase-Variablen und Service-Secret ausschließlich serverseitig konfigurieren.
2. Migration `20260710145249_create_realtime_intelligence.sql` anwenden.
3. `FMP_API_KEY` für FMP-News setzen.
4. `SEC_EDGAR_USER_AGENT` im Format `Produkt/Organisation kontakt@example.com` setzen.
5. Starkes `STOCKPILOT_INTELLIGENCE_INGEST_SECRET` mit mindestens 24 Zeichen setzen.
6. Symbole und CIK-Zuordnungen in `STOCKPILOT_INTELLIGENCE_SYMBOLS` und `STOCKPILOT_SEC_ENTITIES` konfigurieren.

## Lokaler Ablauf

```bash
npm install
npm run db:test
npm run test:intelligence
npm run typecheck
npm run lint
npm run build
```

`db:test` benötigt Docker und setzt ausschließlich die lokale Supabase-Datenbank zurück. Niemals mit `--linked` gegen Produktion ausführen.

## Ingestion

Cron-kompatibler Abruf aus ENV-Konfiguration:

```bash
curl -H "Authorization: Bearer $STOCKPILOT_INTELLIGENCE_INGEST_SECRET" \
  http://localhost:3000/api/intelligence/ingest
```

Gezielter Serverabruf:

```bash
curl -X POST \
  -H "Authorization: Bearer $STOCKPILOT_INTELLIGENCE_INGEST_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"providers":["fmp","sec_edgar"],"symbols":["AAPL"],"secEntities":[{"symbol":"AAPL","cik":"0000320193"}],"limit":25}' \
  http://localhost:3000/api/intelligence/ingest
```

Ein Vercel-Cronplan wird in dieser Etappe nicht automatisch aktiviert. Takt, Providerlizenz, Quota und Vercel-Plan müssen vor Aktivierung gemeinsam freigegeben werden.

## Observability

Strukturierte Events:

- `intelligence.pipeline_completed`: Eingang, Speicherung, Analysen, Duplikate, Alerts, Fehler und Laufzeit.
- `intelligence.adapter_failed`: isolierter Providerfehler ohne Secret oder URL-Query.
- `intelligence.event_failed`: einzelner Verarbeitungsfehler mit externer ID.
- `intelligence.ai_fallback`: OpenAI-kompatibler Anbieter ist ausgefallen und Regeln wurden verwendet.

Zusätzlich speichern Source- und Jobtabellen letzten Erfolg, letzten Fehler, Status, Versuche und Zeitpunkte. Vollständige Dokumente, Tokens, E-Mail-Adressen und API-Schlüssel werden nicht geloggt.

## Retention

Raw Events besitzen standardmäßig 90 Tage Retention. Die Funktion `private.purge_expired_intelligence_events(limit)` ist nur für `service_role` ausführbar. Vor einem Zeitplan müssen Anbieterrechte, Aufbewahrungspflichten und Wiederherstellungsanforderungen bestätigt werden.

## Fehlerbilder

- Fehlendes FMP-Key: nur der FMP-Lauf schlägt strukturiert fehl; SEC bleibt isoliert.
- Fehlender SEC-User-Agent: SEC wird nicht angefragt.
- Rate Limit: maximal drei Versuche mit exponentiellem Backoff.
- Supabase nicht verfügbar: Feed zeigt `unavailable`; keine Mock-Ereignisse werden eingesetzt.
- Ungültige Modellantwort: ein Reparaturversuch, danach wird der Analysejob als fehlgeschlagen markiert. Nur technische Provider-Ausfälle verwenden den deterministischen Fallback.
- Mehrdeutige Zuordnung: Status `ambiguous`, keine starken Alerts.

## Kostenmodell

- Regelbasierter Analyzer: keine Modell-API-Kosten.
- SEC EDGAR: keine API-Gebühr, jedoch Infrastrukturkosten.
- FMP: tarif- und lizenzabhängig; ohne Vertragsdaten keine belastbare Schätzung.
- OpenAI-kompatibel/vLLM: Kosten werden nur berechnet, wenn Eingabe-/Ausgabepreis pro Million Tokens in ENV gesetzt ist. Formel: `inputTokens / 1e6 × inputPrice + outputTokens / 1e6 × outputPrice`.
- Supabase/Vercel: abhängig von Speicher, Funktionslaufzeit, Egress, Cron-Takt und gebuchtem Plan.

## Notfallbetrieb

1. Betroffenen Provider in `intelligence_sources.enabled` deaktivieren.
2. Ingestion-Secret rotieren, falls ein Aufruf verdächtig ist.
3. Queue-/Jobstatus und `last_error_at` prüfen.
4. Feed bleibt auf zuletzt gespeicherten, quellenbelegten Ereignissen; es wird kein Mock-Fallback aktiviert.
5. Nach Wiederherstellung idempotent erneut ingestieren.
