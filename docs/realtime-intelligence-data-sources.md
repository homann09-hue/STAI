# Realtime Intelligence Datenquellen

## Financial Modeling Prep

- Zweck: Unternehmensnachrichten für priorisierte Symbole.
- Verifizierter Endpoint: `https://financialmodelingprep.com/stable/news/stock?symbols=AAPL`.
- Alternative für allgemeine neueste Meldungen: `https://financialmodelingprep.com/stable/news/stock-latest?page=0&limit=20`.
- Authentifizierung: serverseitiger Query-Parameter `apikey`; niemals im Client oder Log.
- Latenz: als `near_real_time` gekennzeichnet, tatsächliche Aktualität und Börsenabdeckung sind tarifabhängig.
- Rate Limits: tarifabhängig; HTTP 429 wird mit Backoff behandelt.
- Lizenzrisiko: Speicherung, Anzeige, Weitergabe und Retention müssen gegen den konkreten FMP-Vertrag geprüft werden.
- Ereignistypen in Etappe 1: Stock News. Press Releases erhalten später einen separaten Adapter.
- Kostenrisiko: ohne bekannten Tarif nicht seriös bezifferbar. Abrufe werden auf priorisierte Symbole und maximal 100 Ergebnisse begrenzt.
- Offizielle Dokumentation: <https://site.financialmodelingprep.com/developer/docs/stable>

## SEC EDGAR

- Zweck: offizielle regulatorische Meldungen.
- Verifizierter Endpoint: `https://data.sec.gov/submissions/CIK##########.json`.
- Authentifizierung: kein API-Key; deklarierter `SEC_EDGAR_USER_AGENT` mit Kontakt-E-Mail ist erforderlich.
- Fair Access: maximal 10 Requests pro Sekunde. Der Adapter begrenzt sequenzielle Abrufe auf höchstens 8 Requests pro Sekunde.
- Latenz: SEC beschreibt die JSON-Strukturen als tagsüber aktualisiert; STAI kennzeichnet sie als `near_real_time`, nicht als Tick-Realtime.
- Ereignistypen: 8-K, 10-Q, 10-K, Form 4, SC 13D, SC 13G und 13F-HR inklusive ausgewählter Amendments.
- Lizenz-/Betriebsrisiko: öffentliche Behördendaten; Fair-Access-, Privacy- und Security-Regeln bleiben verbindlich.
- Kostenrisiko: keine API-Gebühr, aber Infrastruktur-, Speicher- und Analyseaufwand.
- Offizielle Dokumentation: <https://www.sec.gov/search-filings/edgar-application-programming-interfaces>
- Fair Access: <https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data>

## Bestehende Provider

Marketaux und NewsAPI bleiben in der bestehenden UI-News-Schicht. Sie werden erst nach Lizenzprüfung und einem dedizierten Adapter in die persistente Intelligence-Pipeline aufgenommen. Mock-News werden ausdrücklich nicht ingestiert.

## Reddit und Social Media

Nicht implementiert. Voraussetzung sind offizielle OAuth-APIs, dokumentierte Rate Limits, Zweck- und Retention-Prüfung sowie eine Minimierung personenbezogener Daten. Scraping ist ausgeschlossen.

## Datenqualität

Jeder Source-Datensatz speichert Provider, Latenzklasse, Vertrauenswert, letzten Erfolg und letzten Fehler. Bestätigungsstatus und Entity-Konfidenz werden je Ereignis gespeichert und getrennt vom Modellscore angezeigt.
