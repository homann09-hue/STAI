# Observability, SLI und SLO

Die Werte sind Pilotziele, keine vertraglichen SLAs.

| SLI | Pilotziel | Warnung | Kritisch |
| --- | ---: | ---: | ---: |
| API-Verfügbarkeit | 99,5 % / 30 Tage | <99,7 % | <99,5 % |
| API p95 | <750 ms normal | >750 ms | >2.000 ms |
| Quote-Freshness | provider-/marktgerecht | > deklarierter Delay | Qualität falsch markiert |
| Pipeline-Fehlerrate | <1 % | >1 % | >5 % |
| Quarantänerate | Baseline je Provider | +2 Sigma | >10 % Burst |
| Alert-Zustellzeit | <5 min | >5 min | >15 min |
| Model Schema Validation | 100 % | <100 % | ungeprüfte Ausgabe sichtbar |
| Entity Confidence | >=0,9 für Autoalert | <0,9 Review | Autoalert unter Schwelle |
| Cache Hit Rate | beobachten | <50 % | Kosten-/Providerlimit |
| KI-Kosten | Budget | 80 % | 100 % Hard Stop |

Benötigte Signale: strukturierte Logs, Request-ID, Providerstatus, p50/p95/p99, Throughput, Saturation, Queue Depth, Retry/Timeout, DQ, Model Drift, Security Events und Kosten. Der Code liefert Logs/Health; ein zentrales Metrics-/Tracing-/SIEM-Backend ist offen.
