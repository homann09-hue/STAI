# CI/CD nach §17

Stand: 2026-08-08

## Was in der Pipeline laeuft

`StockPilot CI` (`.github/workflows/ci.yml`) — bei **jedem Push und jedem Pull
Request**:

| Schritt | Befehl |
|---|---|
| Install | `npm ci` |
| Formatierung | `npm run format:check` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` (`--max-warnings=0`) |
| Unit-Tests mit Coverage-Schwelle | `npm run test:coverage` |
| Production Build | `npm run build` |
| Performance-Budget | `npm run performance:budget` |
| Statische Enterprise-Gates | `npm run enterprise:check` |
| Sprach- und Rechtsformulierungen | `npm run qa:grammar` |
| Dependency-Audit | `npm run audit:safe` |
| Lizenz-Audit | `npm run audit:licenses` |
| SBOM und Evidenz | `npm run evidence:generate` |

`Database Tests` (`.github/workflows/database-tests.yml`) — ebenfalls bei Push
und Pull Request: startet einen isolierten Supabase-Stack, setzt das Schema aus
den Migrationen neu auf und faehrt `supabase test db` (7 pgTAP-Suiten, 135
Zusicherungen).

**Geaendert am 2026-08-08:** beide Workflows liefen zuvor nur auf `main` und auf
Pull Requests dagegen. Ein Feature-Branch ohne offenen PR war damit voellig
ungeprueft — genau so lagen hier 27 Commits vier Wochen lang, ohne dass CI sie
je gesehen hat.

## Wie das Deployment abgesichert ist

§17 verlangt: „Deployment darf nicht erfolgen, wenn kritische Checks
fehlschlagen."

`vercel-manual.yml` erfuellt das bereits durch seinen Aufbau: Formatierung,
Typecheck, Lint, Tests mit Coverage-Gate, Sprachaudit, Dependency-Audit,
institutionelle Kontrollen, Build, Performance-Budget und ein
**Browser-E2E-Smoke-Gate** stehen als Schritte **vor** `vercel deploy` im selben
Job. Faellt einer, bricht der Job ab und es wird nichts ausgeliefert.

Daneben lief bis heute die Git-Anbindung von Vercel — und die deployt
unabhaengig von jedem Check. Zwei Wege, einer davon ohne Tuer.

**Deshalb ist der Produktions-Autodeploy aus Git jetzt abgeschaltet:**

```json
"git": { "deploymentEnabled": { "main": false } }
```

Vorschau-Deployments fuer Branches und Pull Requests bleiben unveraendert — sie
sind nuetzlich und beruehren die Produktion nicht. Produktion laeuft ab jetzt
ausschliesslich ueber den gegateten Workflow.

**Rueckgaengig** in einer Zeile: den Wert auf `true` setzen oder den
`git`-Block entfernen.

### Was der Produktionsdeploy braucht

Der Workflow prueft die Secrets, bevor er irgendetwas ausliefert:
`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. Fehlt eines, bricht er mit
einer klaren Meldung ab, statt halb zu deployen.

Aufruf: Actions → *StockPilot Manual Vercel Deploy* → `target: production` und
die verlangte ausdrueckliche Bestaetigung.

## Was ich nicht aus dem Repository heraus setzen kann

**Branch Protection auf `main`.** Sie lebt in den GitHub-Einstellungen, nicht im
Code. Ohne sie kann jemand mit Schreibrecht an allen Checks vorbei direkt auf
`main` pushen.

Einzurichten unter *Settings → Branches → Add rule* fuer `main`, mit diesen
erforderlichen Checks:

- `Typecheck, lint, test and build` (aus `StockPilot CI`)
- `pgtap` (aus `Database Tests`)

Dazu „Require branches to be up to date before merging".

## Bewusst nicht in der Pipeline

**E2E im normalen CI-Lauf.** Die fuenf Playwright-Specs laufen im
Deploy-Workflow als Smoke-Gate und im Red-Team-Lauf, nicht bei jedem Push. Sie
brauchen einen Build und einen laufenden Server; das verdreifacht die Laufzeit
jedes Commits fuer einen Nutzen, der bei einem Deploy-Gate besser aufgehoben
ist. Wenn die Suite waechst, gehoert diese Entscheidung neu geprueft.

**Last- und Chaostests** (`test:load`, `test:stress`, `test:chaos`) laufen
manuell ueber `redteam.yml` und `capacity.yml`. Sie sind zu langsam und zu
laut fuer jeden Commit.
