# Test Report

Dieser Bericht wird durch die lokalen Pruefskripte gestuetzt.

## Abgedeckt

- Unit Tests fuer Score-Berechnungen.
- Unit Tests fuer Risiko-Engine.
- Unit Tests fuer Portfolio-Berechnungen und Transaktionen.
- Unit Tests fuer API-Fallback-Cache.
- Unit Tests fuer Input-Validation.
- E2E-Smoke-Tests fuer Dashboard, Detailanalyse und Portfolio.
- Build-Test ueber `npm run build`.
- Lint-Test ueber `npm run lint`.
- Typecheck ueber `npm run typecheck`.

## Lokale Kommandos

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
npm run audit:safe
```

## Hinweise

- E2E benoetigt installierte Playwright-Browser.
- Audit ist aktuell auf `high` gesetzt, damit moderate transitive Findings dokumentiert, aber nicht automatisch mit Breaking Changes gefixt werden.

## Ergebnis vom 2026-06-29

- `npm run typecheck`: bestanden.
- `npm run lint`: bestanden, 0 Warnungen.
- `npm run test`: bestanden, 6 Testdateien, 10 Tests.
- `npm run build`: bestanden.
- `npm run test:e2e`: bestanden, 6 Tests ueber Mobile Chrome und Desktop Chrome.
- `npm run audit:safe`: bestanden auf High/Critical-Level. Es bleiben 2 moderate transitive Findings ueber `next`/internes `postcss`; `next@16.2.9` ist laut `npm view next version` die aktuelle stabile Version. `npm audit fix --force` wuerde einen Breaking-Downgrade vorschlagen und wurde bewusst nicht ausgefuehrt.
