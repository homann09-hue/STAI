# Blocker und offene Risiken

Stand: 2026-08-21

Dieses Dokument trennt intern lösbare Arbeit strikt von Abhängigkeiten, die
nicht durch Code allein abgeschlossen werden können.

## Intern lösbar

| Priorität | Thema | Aktueller Stand | Nächster belegbarer Schritt |
|---|---|---|---|
| P1 | Stripe-safe Kontolöschung | PR #100 und PR #101 gemergt; alle Pflichtchecks grün | Produktionsmigration und ausschließlich StockPilot deployen, dann Live-/Stripe-Testmode prüfen |
| P1 | Eingefrorene PR-Kette #87–#97 | Als Entwurf eingefroren | Nach Stabilisierung einzeln bewerten und kontrolliert übernehmen |
| P1 | Realtime-Hub, Alerts und Provider-Orchestrierung | Nicht als produktionsreif belegt | Erst nach Billing-Stabilisierung als einzelne Arbeitspunkte umsetzen |
| P1 | Prognosen, Portfolio, Backtesting und Analyse | Teilfunktionen vorhanden, Gesamt-Reife nicht belegt | Deterministische Berechnung, Datenqualität und End-to-End-Evidenz je Punkt schließen |
| P2 | Cache, Resilienz, PWA, Barrierefreiheit und DSGVO | Teilweise vorhanden | Nach P0/P1 jeweils mit messbarer Abnahme bearbeiten |

## BLOCKED – EXTERNAL

### FMP-Instrumentuniversum und Symbolzugriff

**Nachweis:** Am 2026-08-07 lieferten Legacy-Verzeichnis-Endpunkte HTTP 403,
`stable/company-screener`, `stable/available-exchanges` und `stable/search-isin`
HTTP 402. `stable/quote` ist symbolweise freigeschaltet und nicht heuristisch
vorhersagbar.

**Auswirkung:** Ein vollständiges globales Instrumentuniversum und garantierte
Kursabdeckung dürfen mit dem aktuellen Tarif nicht behauptet werden.

**Aktivierung:** Geeigneten Provider-Tarif und Börsen-/Redistributionsrechte
vertraglich freischalten; anschließend Verzeichnis-Sync und Coverage-Evidenz
ausführen.

### Externe Anzeige- und Redistributionsrechte

**Nachweis:** Für SEC EDGAR, ECB und weitere Provider liegt im Repository kein
freigegebener Nachweis für `external_display` vor. Produktionsrouten sperren die
Anzeige deshalb fail-closed.

**Auswirkung:** Daten dürfen trotz technisch vorhandener Adapter nicht extern
als freigeschaltet dargestellt werden.

**Aktivierung:** Rechteinhaber, Lizenzumfang, erlaubte Felder, Aktualität,
Attribution und Aufbewahrung schriftlich bestätigen und in der Provider-
Governance hinterlegen.

### Produktionskonfiguration

**Nachweis:** Der Produktions-Healthcheck meldete am 2026-08-17
`adminSecretConfigured=false`.

**Auswirkung:** Geschützte Betriebsdiagnostik kann nicht vollständig verifiziert
werden; öffentliche Diagnose bleibt korrekt gesperrt.

**Aktivierung:** Secret ausschließlich im Vercel-Projekt `stockpilot-ai`
setzen, neu deployen und geschützten Diagnosepfad prüfen.

### Nicht durch Code abschließbare Freigaben

Apple-Signing, rechtlich geprüfte Texte, Support-/SLA-Zusagen sowie Stripe-
Liveprodukte und Zahlungsfreigabe benötigen Kontoinhaber-, Vertrags- oder
Rechtsfreigaben. Sie gelten nur dann als blockierend, wenn der jeweilige
Arbeitspunkt technisch vollständig ist und die konkrete externe Freigabe mit
Nachweis angefordert wurde.

### Stripe-Testmode für die Kontolöschung

**Nachweis:** Unit-, Route-, Webhook-, Recovery-, Browser- und Datenbanktests
sind vollständig grün. Im Repository ist jedoch kein freigegebener Stripe-
Testkunde mit aktiver Subscription und signiertem Test-Webhook vorhanden.

**Auswirkung:** Der echte Provider-Lebenszyklus kann nicht als End-to-End
verifiziert bezeichnet werden. Die Implementierung bleibt fail-closed; Billing
bleibt deaktiviert.

**Aktivierung:** Stripe-Testprodukte, Testpreise, Testkunde, aktive Test-
Subscription und Webhook-Secret im isolierten StockPilot-Testprojekt anlegen;
danach Löschung, Kündigung, Webhook-Rennen und kontrollierten Stripe-Ausfall
ausführen und protokollieren.

**Aktualisierung 2026-08-22:** Der Live-Zugang `Ovora` wurde nicht verwendet.
Eine vollständig isolierte Claimable-Sandbox wurde erzeugt und ihr
eingeschränkter `rkcs_test_`-Schlüssel ausschließlich in der geschützten
GitHub-Environment `stripe-testmode` hinterlegt. Checkout, Portal, signierte
Webhooks, Kündigung, Account-Löschung und Late-Webhook-Isolation liefen damit
gegen echte Testmode-Ressourcen. Live-Schlüssel und Remote-Ziele werden
technisch abgewiesen.

**Sandbox-Probe 2026-08-22:** Lauf `32554651375` erreichte ausschließlich beim
Erzeugen einer Stripe Test Clock einen HTTP-403-Permissionfehler. Claimable-
Schlüssel dürfen diesen Endpunkt nicht aufrufen. Die verbleibende externe
Freigabe ist damit eng begrenzt: die bereits isolierte StockPilot-Sandbox über
ihren geheimen Claim-Link dem Eigentümerkonto zuordnen und anschließend einen
vollständigen Testmode-Key ausschließlich in `stripe-testmode` hinterlegen.
Das vorhandene Livekonto und BauPro bleiben unberührt.

**Priorisierungsentscheidung 2026-08-22:** Stripe wird auf ausdruecklichen
Nutzerwunsch vorerst uebersprungen. Der Blocker bleibt unveraendert offen,
Billing bleibt deaktiviert und keine Paid-Funktion wird als freigeschaltet
dargestellt. Die Produktarbeit wird mit Phase 2 fortgesetzt.

### Phase-1.1-Remote-Lifecycle bleibt blockiert

**Nachweis:** Am 2026-08-22 antwortete
`/api/account/deletion/reconcile` auf der Live-Domain kontrolliert mit HTTP
401 statt des früheren HTTP 404. Route und Autorisierung sind damit deployt.
Das verknüpfte Supabase-Projekt ist jedoch weiterhin inaktiv; Migration,
Saga-Persistenz und echter Stripe-/Account-Lebenszyklus sind remote nicht
belegt.

**Auswirkung:** Die alte Aussage, Phase 1.1 sei noch nicht deployt, ist
aufgehoben. Eine vollständige Produktionsverifikation bleibt trotzdem
unzulässig, solange Datenbank und Stripe-Testmode-Lifecycle nicht real geprüft
werden können.

**Aktivierung:** Supabase `STAI` reaktivieren, Migrationen kontrolliert
prüfen/anwenden und ausschließlich im Vercel-Projekt `stockpilot-ai` den
Account-Deletion-/Stripe-Testmode-Lebenszyklus prüfen. BauPro bleibt
unangetastet.

### Supabase-Projekt `STAI` ist inaktiv

**Nachweis:** Der Supabase-Management-Connector meldete am 2026-08-21 für
`ircuakhftjcwttwegyac` den Status `INACTIVE`. CLI und Migrationsliste scheitern
mit Datenbank-Verbindungs-Timeout. Der Restore-Aufruf wurde abgewiesen, weil
das Eigentümerkonto sein Free-Limit von zwei aktiven Projekten erreicht hat.
Security- und Performance-Advisor lieferten jeweils null Findings.

**Auswirkung:** Auth, Cloud-Nutzerdaten, Produktionsmigration, kanonische
Instrument-Master-Auflösung und der echte Account-Deletion-/Stripe-
Lebenszyklus sind nicht verifizierbar. Kanonische Quote- und Stream-Routen
bleiben bei fehlendem Instrument Master bewusst fail-closed. Phase 1.1 ist
intern abgeschlossen, aber nicht produktionsaktiv.

**Aktivierung:** Supabase-Tarif erhöhen oder durch den Kontoinhaber einen Slot
bei einem anderen Projekt freigeben. Anschließend ausschließlich `STAI`
reaktivieren, Migrationen prüfen/anwenden und StockPilot live verifizieren.
BauPro und alle anderen Projekte wurden nicht verändert.

## Aktuelle Lieferblocker

### Vercel-Deployment-Tageslimit für PR #126

**Nachweis:** Der native Vercel-Status für PR #126 wurde am 2026-08-22 mit
`Deployment rate limited - retry in 24 hours` abgewiesen. Ein lokal erfolgreich
gebautes echtes Prebuilt-Artefakt scheiterte beim Upload ebenfalls mit
`api-deployments-free-per-day`: mehr als 100 Deployments. App-CI und pgTAP sind
grün; ein neues Preview-Deployment wurde nicht erzeugt.

**Auswirkung:** Die technisch lokal und in einer realistischen
Production-Sandbox geprüfte Timeout-Remediation bleibt offen. Der rote
Vercel-Pflichtcheck wird nicht umgangen; PR #126 wird nicht gemergt und der
aktuelle Production-Stand bleibt unverändert erreichbar.

**Aktivierung:** Nach Ablauf des Limits oder einer Vercel-Tariferhöhung den
nativen Preview-Check für PR #126 neu ausführen, Preview-Latenz messen, erst bei
grünen Pflichtchecks geschützt mergen und anschließend ausschließlich
`stockpilot-ai` in Production prüfen. BauPro bleibt unberührt.

GitHub ist wieder betriebsbereit; PR #99 wurde gemergt und Phase 0 ausschließlich
im StockPilot-Projekt deployt. BauPro ist kein Bestandteil dieses Repositories
und wurde nicht verändert.
