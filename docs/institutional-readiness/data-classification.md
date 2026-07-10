# Datenklassifikation

| Klasse | Beispiele | Speicherung/Verschlüsselung | Zugriff/Logging | Retention/Löschung |
| --- | --- | --- | --- | --- |
| public | freigegebene Marktdaten, Lerntexte | Managed TLS/at rest | öffentlich, keine Secrets | Lizenzvertrag |
| internal | Systemstatus, normalisierte Provider-Metadaten | Managed TLS/at rest | Mitarbeiterrollen | betrieblicher Bedarf |
| confidential | Portfolio, Watchlist, Analysen, Auditmetadaten | RLS, serverseitig | Nutzer/authorisierte Rollen, redigierte Logs | Nutzer-/Vertragsfristen |
| restricted | API-Keys, Tokens, Raw Payloads, Security Events | Secret Store/server-only | minimal privilegiert, niemals Klartextlog | Rotation/Provider-/Legal-Regeln |

Produktionsdaten dürfen nicht in Tests oder Evidence Packs gelangen. Supportzugriff auf confidential/restricted Daten ist nicht als aktive Self-Service-Funktion implementiert.
