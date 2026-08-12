# Datenanbieter, Rechte und Routing

Stand: 2026-08-12

## Sicherheitsprinzip

Ein vorhandener API-Schlüssel beweist weder Realtime-Rechte noch das Recht,
Daten öffentlich an Endnutzer auszuliefern. StockPilot trennt deshalb
technische Konfiguration, Adapterfähigkeit und Nutzungsrecht. Erst wenn alle
drei Ebenen positiv sind, darf ein Provider geroutet werden.

Die maschinenlesbare Quelle ist
`src/lib/providers/provider-registry.ts`. Sie enthält je Anbieter Umgebung,
Feed-Typ, Nutzungsrechte, bekannte Verzögerung, Attributionspflicht,
Verifikationsstatus, Capabilities und Assetklassen.

## Konservative Voreinstellung

Kostenlose oder unbekannte Tarife sind für interne Entwicklung zugelassen,
aber für Preview und Produktion gesperrt. Es gibt keinen stillen Fallback auf
einen nicht verifizierten Anbieter. Auch SEC EDGAR und EZB werden trotz ihres
Status als offizielle öffentliche Quellen nicht automatisch für die externe
Anzeige freigeschaltet; ihre Bedingungen und Attribution bleiben
verpflichtend.

## Produktionsfreigabe

Eine Freigabe braucht alle drei Einstellungen:

```dotenv
MARKET_DATA_ALLOW_EXTERNAL_DISPLAY=true
MARKET_DATA_LICENSE_VERIFIED_PROVIDERS=fmp,finnhub
MARKET_DATA_EXTERNAL_DISPLAY_PROVIDERS=fmp,finnhub
MARKET_DATA_LICENSE_VERIFIED_AT=2026-08-12
```

Die Listen dürfen nur Provider enthalten, deren konkreter Vertrag und Tarif
für diesen Einsatzzweck geprüft wurden. `redistributionAllowed` bleibt davon
unabhängig standardmäßig `false`.

## Entscheidungsreihenfolge

1. registrierter Provider,
2. implementierter Adapter,
3. passende Capability,
4. passende Assetklasse,
5. aktivierter Schalter,
6. vollständige serverseitige Konfiguration,
7. Recht für den konkreten Nutzungszweck,
8. Health-/Circuit-Breaker-Status.

Gesunde Provider laufen vor degradierten Providern. Offene Circuit Breaker
und nicht verfügbare Provider werden mit maschinenlesbarer Begründung
ausgeschlossen. Der geschützte Health-Endpunkt liefert die Registry ohne
Secret-Werte unter `marketDataRouting` aus.

API-Routen prüfen die Freigabe vor Cache und Providerabruf. Eine fehlende
Freigabe wird als `503` gemeldet und niemals als „Instrument nicht gefunden“,
leere echte Datenreihe oder aktiver Provider ausgegeben.

`implemented` bedeutet nur, dass ausführbarer Adaptercode vorhanden ist, nicht
dass Tarif, Abdeckung oder Lizenz genügen. `prepared` bedeutet, dass der
Provider im Zielrouting vorgesehen ist, aber noch nicht ausgeführt wird.
