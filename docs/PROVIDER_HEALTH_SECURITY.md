# Provider-Health: Sicherheitsmodell

Stand: 2026-08-17

Provider-Pings sind eine geschützte Admin-Funktion. Öffentliche Anfragen lösen
keine externen Requests aus und verbrauchen keine Provider-Quotas.

## Netzwerkschutz

- Jeder allgemeine Ping läuft über `fetchBoundedProviderJson`.
- Nur HTTPS und explizit erlaubte Provider-Hosts sind zulässig.
- Timeout und Antwortgröße sind enger als bei regulären Datenabrufen begrenzt.
- JSON-Inhalt wird geprüft; HTML-Fehlerseiten gelten nicht als Erfolg.
- Circuit-Breaker, Request-Budget und Rate-Limit-Cooldown gelten auch für Pings.
- Providerfehler werden in sichere, allgemeine Meldungen übersetzt.

## Secrets

NewsAPI-Authentifizierung wird als serverseitiger `X-Api-Key`-Header gesendet.
Der Schlüssel ist dadurch weder Bestandteil der URL noch des Request-Keys.
Provider, die ausschließlich Query-Authentifizierung unterstützen, bleiben auf
HTTPS beschränkt; der zentrale Request-Key speichert nur einen SHA-256-Hash.

Ping-Ergebnisse enthalten niemals Schlüssel, URLs oder rohe Providerfehler.
