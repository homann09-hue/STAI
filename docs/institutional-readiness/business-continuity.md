# Business Continuity

| Szenario | Fortführung | Grenze |
| --- | --- | --- |
| Marktprovider aus | Cache/Fallback, Qualität degraded | keine Live-Behauptung |
| KI-Provider aus | Rohdaten + deterministischer Fallback | keine neue LLM-Analyse |
| Supabase aus | öffentliche Mock/Providerflächen, lokale PWA | kein Cloud-Sync/Auth |
| Vercel aus | Wiederdeploy/alternative statische Hinweise | kein aktiver Zweitstandort |
| beschädigte Migration | Writes stoppen, Rollback/Restore | Restore noch nicht geübt |
| kompromittierter Key | Rotation, Provider deaktivieren | Reaktionsrollen erforderlich |
| DQ-Problem | Quarantäne, Downstream sperren | manuelle Freigabe |
| Modellfehlverhalten | Kill Switch, Human Review | Validierungsteam erforderlich |
| Traffic-Spike | Cache, Rate Limit, Degraded Mode | Shared Cache fehlt live |
| Kostenexplosion | Budget Hard Stop | Live-Kostenfeed fehlt |
| Datenlizenz-Sperre | Provider deaktivieren, Daten entfernen | Ersatzprovider/Vertrag nötig |

Ein jährlicher organisatorischer BCP-Test sowie halbjährliche technische Provider-/Restore-Drills sind vor Enterprise-Betrieb einzuplanen.
