# STAI Function Improvement Audit

Stand: 2026-07-01

## Ergebnis dieser Runde

STAI hat jetzt eine zentrale Funktions-Audit-Schicht. Jede Hauptfunktion wird nach Produktreife, Datenwahrheit, Abhängigkeiten und nächstem Fix bewertet. Diese Logik ist im Dashboard verdichtet sichtbar und in den Einstellungen voll einsehbar.

## Verbesserte Funktionsbereiche

- Dashboard: Roadmap-Kacheln durch echte Funktionsmetriken ersetzt.
- Einstellungen: neuer Funktions- und Vertrauenscheck als Kontrollraum.
- Provider Health: neues Datenkontrollzentrum für API-Keys, Anbieterstatus, Fallbacks, Datenqualität und nächste Backend-Schritte.
- Backend Health: `/api/health` erweitert und `/api/providers/health` als eigener Provider-Status-Endpoint ergänzt.
- Provider Pings: `/api/providers/ping` misst Provider-Latenz, Fehler und Rate-Limit-Status serverseitig ohne Secret-Leaks.
- Billing/Entitlements: `/api/billing/entitlements` und Supabase-Entitlement-Struktur vorbereitet.
- Notification Center: zentrale Hinweise für Alerts, Provider, System, Billing und Datenqualität ergänzt.
- Cron Alert Worker: `/api/alerts/run` plus Vercel Cron-Konfiguration für serverseitige Alert-Ausführung ergänzt.
- Global Search: Command Palette mit `CMD/CTRL+K` für Seiten, Assets, Provider- und Research-Flows ergänzt.
- Portfolio: mehrere lokale Portfolios, Kopieren, Löschen, Wechseln und Transaktionshistorie ergänzt.
- Alerts: Schwellen, Frequenz, Kanal, Löschen und lokale Prüfung mit Statusauswertung ergänzt.
- Backtesting: nutzbares lokales Szenario-Labor mit Rendite, Volatilität, Drawdown und gespeicherten Szenarien ergänzt.
- Kalender: lokale Event-Verwaltung mit Demo-/Nutzer-Datenqualität ergänzt.
- Analysen: lokale Analyse-Workbench mit Bull/Bear/Neutral Case und normalisierten Wahrscheinlichkeiten ergänzt.
- Marktuniversum: große Trefferlisten auf 80 sichtbare Zeilen begrenzt, Empty-State ergänzt, Suchfeld begrenzt.
- PWA: sichtbare Hinweise für Offline, wieder online und neue App-Versionen.
- Produkttransparenz: live, eingeschränkt, Demo, vorbereitet und blockiert werden getrennt.

## Kritische Produktwahrheiten

- Realtime ist nur dort echt, wo Provider, Lizenz und Marktstatus es erlauben.
- ETF-Profi-Daten, Alerts, Backtesting und Billing brauchen weitere Backend-/Provider-Integration.
- Mock- und Demo-Funktionen duerfen keine echten Investment-Signale darstellen.
- Portfolio und Screener sind erst dann voll belastbar, wenn Universumsdaten und aktuelle Quotes komplett sind.

## Naechste konkrete Schritte

1. Provider-Coverage pro Assetklasse live aus API-Health-Daten speisen.
2. Server-Jobs fuer Alerts, Earnings und News-Refresh bauen.
3. Billing-/Entitlement-Status an Pricing und Feature-Gates koppeln.
4. Historische Daten fuer Backtesting adjustieren und Methodik dokumentieren.
5. UI-Regression, Typecheck, Tests und Build nach dieser Änderungsrunde ausführen.
