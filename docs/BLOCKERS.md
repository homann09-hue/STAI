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

### Phase-1.1-Produktion ist noch nicht aktualisiert

**Nachweis:** Am 2026-08-21 antwortete
`/api/account/deletion/reconcile` auf der Live-Domain mit HTTP 404. Das aktive
Deployment `dpl_2ZDn9sQbFaemkmdQmWDszXGMUpaQ` stammt vor dem Merge von PR #100
und enthält weder Worker-Route noch Account-Deletion-Cron. Die verknüpfte
Supabase-Migrationsprüfung scheiterte zusätzlich an einem Control-Plane-
Timeout; der Produktionsschema-Stand ist deshalb nicht belegt.

**Auswirkung:** Phase 1.1 darf trotz grüner lokaler Gates nicht als live oder
produktionsverifiziert bezeichnet werden.

Das native PR-Preview wurde erfolgreich gebaut. Sein Runtime-Healthcheck ist
jedoch durch Vercel Deployment Protection ohne gültige Preview-Autorisierung
nicht öffentlich prüfbar; der Workflow weist diesen Zustand ausdrücklich aus.

**Aktivierung:** Neue Migration kontrolliert auf das Supabase-Projekt `STAI`
anwenden, nur das Vercel-Projekt `stockpilot-ai` deployen, Worker-Route,
Cron-Autorisierung, Logs und Stripe-Testmode-Lebenszyklus prüfen. BauPro bleibt
unangetastet.

## Aktuell kein belegter Lieferblocker

GitHub ist wieder betriebsbereit; PR #99 wurde gemergt und Phase 0 ausschließlich
im StockPilot-Projekt deployt. BauPro ist kein Bestandteil dieses Repositories
und wurde nicht verändert.
