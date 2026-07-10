# Change und Release Management

| Klasse | Beispiele | Freigabe |
| --- | --- | --- |
| standard | dokumentierte risikoarme Wartung | Owner + CI |
| normal | Feature/API intern | Reviewer + Tests + Rollback |
| high_risk | Auth, RLS, Migration, Modell/Prompt, Datenprovider | zweite Prüfung, Security, Migration/Performance, Restoreplan |
| emergency | aktive Sicherheits-/Datenstörung | Incident Commander, minimale Änderung, nachträgliches Review |

`change_records` speichert Risiko, Owner, Reviewer, Testevidence, Rollback- und Monitoringplan. Produktionsdeployment ist manuell bestätigt und muss beobachtet sowie nachkontrolliert werden. Direkte Datenbankänderungen außerhalb versionierter Migrationen sind verboten.
