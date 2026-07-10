# Realtime Intelligence Scoring

## Grundsatz

Der Impact Score misst erwartete Bedeutung, nicht die Wahrscheinlichkeit einer positiven Kursbewegung. Richtung, positiver Impact und negativer Impact werden separat gespeichert.

## Komponenten

- `eventSeverity`: deterministische Basis je Ereignistyp.
- `relevance`: strukturierte Relevanzbewertung der Analyse.
- `credibility`: Quellen- und Bestätigungsqualität.
- `novelty`: Neuigkeitswert; bekannte Duplikate erhalten keine neue Analyse.
- `entityConfidence`: Sicherheit der Unternehmenszuordnung.
- `confirmationFactor`: 100 bestätigt, 82 teilbestätigt, 58 unbestätigt, 40 mehrdeutig.
- `magnitude`: Kombination aus Ereignisschwere und Relevanz.
- `marketReaction`: nur gesetzt, wenn zeitlich korrekte Marktdaten vorliegen.
- `volumeReaction`: nur gesetzt, wenn zeitlich korrekte Volumendaten vorliegen.
- `modelConfidence`: Mittelwert der Fakt-Konfidenzen.
- `independentSources`: Zahl unabhängiger Bestätigungen, begrenzt auf einen kleinen Boost.

## Formel

```text
product = severity
        × relevance
        × credibility
        × novelty
        × entityConfidence
        × confirmationFactor

impact = normalize(product ^ 0.42 × independentSourceBoost, 0..100)
```

Alle Faktoren werden vor der Multiplikation auf 0 bis 1 normiert. Die Potenz verhindert, dass ein einzelner moderater Faktor jedes Ereignis unverhältnismäßig auf nahezu null drückt. Ein schwaches Quellen- oder Entity-Signal begrenzt den Score trotzdem deutlich.

## Richtung

- `positive`: positiv interpretierte Faktoren überwiegen.
- `negative`: negativ interpretierte Faktoren überwiegen.
- `mixed`: positive und negative Faktoren sind gleichzeitig vorhanden.
- `unclear`: Richtung kann nicht belastbar abgeleitet werden.

## Alert-Regeln

Ein interner Watchlist-Alert wird nur erzeugt, wenn:

- Impact mindestens 70,
- Entity-Konfidenz mindestens 0,90,
- Glaubwürdigkeit mindestens 75,
- Neuigkeitswert mindestens 70,
- Ereignis nicht bereits bekannt und kein Duplikat,
- Symbol auf einer Nutzer-Watchlist steht.

`critical` kann das Modell nicht allein setzen. Zusätzlich sind Impact mindestens 90, bestätigter Status und ein deterministisch zugelassener Ereignistyp erforderlich.

## Look-ahead Bias

Markt- und Volumenreaktionen bleiben `null`, bis ein separater zeitpunktkorrekter Sammler verfügbar ist. Historische Analysen dürfen nur Informationen verwenden, die zum jeweiligen Analysezeitpunkt bereits bekannt waren.
