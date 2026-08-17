# Execution Ledger

Stand: 2026-08-17
Gesamtstatus: **OPEN**

<!-- ACTIVE_WORKPOINT: PHASE-0-GOVERNANCE-V4 -->

## Aktive Phase

| Feld | Aktueller, belegter Stand |
|---|---|
| Aktive Phase | Phase 0 – Wahrheit und Governance |
| Arbeitspunkt | Projektverfassung v4, Lieferweg, Evidenz und QA-Gate konsolidieren |
| Ausgangsfehler | Mehrere widersprüchliche Statusstände, gestapelte PRs und roter Red-Team-Lauf |
| Ursache | Frühere Arbeit wurde vor Merge/Deployment des Vorgängers gestapelt; lokaler Stress-Client hatte nur 256 Sockets für ein 500er Gate |
| Implementierte Lösung | PRs #87–#97 eingefroren; eine Autorität; ein aktiver Arbeitspunkt; Governance-Gate; Socket-Pool deckt Release-Gate ab |
| Branch | `codex/phase-0-governance-v4` direkt von `main` |
| Basis-Commit | `2189a9d2471eb95a40867592a37cd9345390839b` |
| Pull Request | [#99](https://github.com/homann09-hue/STAI/pull/99) |
| Status | OPEN |

## Verifikationsstand

| Prüfung | Evidenz | Status |
|---|---|---|
| Aktueller `main` | StockPilot CI Run 31969837599 | erfolgreich |
| Datenbank-CI | Run 31969837593 | erfolgreich |
| Live-Monitoring | Run 32039456654 | erfolgreich |
| Pull-Request-CI | [Run 32040324387](https://github.com/homann09-hue/STAI/actions/runs/32040324387) | erfolgreich |
| Unit-Tests | 152 Dateien / 1.146 Tests | erfolgreich |
| Coverage gesamt | 47,61 % Statements / 45,29 % Branches / 47,20 % Functions / 49,41 % Lines | Gate erfolgreich |
| Build | 35 statische Seiten erzeugt | erfolgreich |
| Browser-E2E | 35 bestanden / 1 übersprungen | erfolgreich |
| Datenbank-CI | [Run 32040324335](https://github.com/homann09-hue/STAI/actions/runs/32040324335), 10 Dateien / 224 Assertions | erfolgreich |
| Red-Team | [Run 32040526871](https://github.com/homann09-hue/STAI/actions/runs/32040526871) | erfolgreich |
| 500er Release-Gate | 500/500 HTTP 200, 0 Timeouts, p95 6.101 ms | erfolgreich |
| 2.000 aktive Sessions | 2.000/2.000 HTTP 200, 0 Fehler | erfolgreich |
| 2.000er Sofortspitze | 1.657/2.000 HTTP 200, 343 Timeouts | nicht-gatende Kapazitätsgrenze dokumentiert |
| Dependency Audit | 0 bekannte Schwachstellen | erfolgreich |
| Production Health | `/api/health`, geprüft 2026-08-17 | HTTP 200 |
| Branch Protection | GitHub API zweimal HTTP 503 | nicht verifiziert |

## Eingefrorene Arbeit

PRs #87 bis #97 sind Entwürfe und mit einem Freeze-Hinweis versehen. Sie werden
weder blind gemergt noch geschlossen. Wiederverwendbare Änderungen dürfen erst
nach Stabilisierung einzeln auf den dann verifizierten `main` übernommen werden.

## Nächster zulässiger Arbeitspunkt

Erst nach `COMPLETE – VERIFIED` für Phase 0: **Phase 1.1 – Stripe-safe account
deletion**. Keine Provider- oder Feature-Arbeit vorher.
