# Performance Report

## Messaufbau

- Lokaler Next.js-Produktionsbuild, Apple-Silicon-Entwicklungsgerät, 30 sequenzielle Requests je Pfad.
- Produktionsbaseline: 5 schonende Requests je Pfad gegen den eigenen Vercel-Alias.
- Keine aggressive Last gegen Drittanbieter oder Produktionsdatenbank.

## Baseline vor Fixes

| Pfad | Lokal p50 | Lokal p95 | Lokal p99 | Vercel p50 | Vercel p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/` | 48 ms | 354 ms | 856 ms | 459 ms | 1087 ms |
| `/api/health` | 1 ms | 5 ms | 9 ms | 148 ms | 434 ms |
| Quotes, 3 Symbole | 1 ms | 12 ms | 157 ms | 31 ms | 40 ms |
| Intelligence, 20 Events | 95 ms | 129 ms | 450 ms | 27 ms | 43 ms |

- Client-Chunk-Verzeichnis: 1.672 KiB.
- Next-Server RSS nach Baseline: rund 355 MiB.

## Verbesserungen

- WebSocket-Queue begrenzt; stale Batches werden unter Backpressure verworfen.
- Portfolio-RPC serialisiert konkurrierende Trades je Nutzer/Symbol.
- KI-Eingabe 12.000 Zeichen, Antwort 64.000 Bytes, Ausgabe standardmäßig 1.400 Tokens.
- Intelligence-Batch global begrenzt; produktiver SEC-Lauf lag bereits bei rund 4,1 Sekunden für 7 Unternehmen.

## Interpretation

Die Änderungen zielen auf Worst-Case-Speicher, Kosten und Konsistenz. Ein belastbarer Vorher-/Nachhervergleich der Produktionslatenz ist erst nach einem separaten, genehmigten Deployment desselben Commits möglich; Werte werden nicht erfunden.

## Finalmessung am 10.07.2026

Vergleich zur Ausgangsmessung, jeweils 30 sequenzielle Requests gegen einen lokalen Production Build:

| Ziel | Ausgang p50/p95/p99 | Final p50/p95/p99 |
| --- | ---: | ---: |
| `/` | 48/354/856 ms | 49/330/833 ms |
| `/api/health` | 1/5/9 ms | 1/4/8 ms |
| Quotes, 3 Symbole | 1/12/157 ms | 1/2/133 ms |
| Intelligence Feed | 95/129/450 ms | 94/126/630 ms |

- JavaScript-Chunks: 1.672 KiB auf 1.563 KiB reduziert.
- Production-Server nach warmen Provider-Caches: rund 402 MiB RSS.
- Das einzelne Intelligence-p99 ist provider- und netzwerkabhängig; p50 und p95 verbesserten sich. Produktionsmonitoring soll deshalb p95/p99 getrennt alarmieren.
- 2.000-Nutzer-Load-Test: p95 13.373 ms, Maximum 14.109 ms, keine Fehler.
- 2.000-Nutzer-Stress-Test: p95 12.448 ms, Maximum 12.752 ms, keine Fehler.
