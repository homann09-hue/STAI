# Automatischer Push

Commits entstehen in einer Sandbox ohne GitHub-Zugangsdaten. Der Push muss
deshalb auf diesem Rechner laufen. Dieser Agent übernimmt das, damit niemand
den Befehl von Hand tippen muss.

## Einrichten — ein Befehl, einmalig

Alles in einem Rutsch aus dem Projektordner heraus:

```bash
cd ~/Documents/PWA-Akti && \
chmod +x scripts/dev/auto-push.sh && \
sed "s|__PROJEKT__|$PWD|g" scripts/dev/ai.stockpilot.autopush.plist \
  > ~/Library/LaunchAgents/ai.stockpilot.autopush.plist && \
launchctl unload ~/Library/LaunchAgents/ai.stockpilot.autopush.plist 2>/dev/null; \
launchctl load ~/Library/LaunchAgents/ai.stockpilot.autopush.plist && \
echo "Auto-Push aktiv."
```

Danach läuft der Agent alle drei Minuten — auch wenn kein Chat offen ist.

## Prüfen, ob er arbeitet

```bash
tail -5 ~/Documents/PWA-Akti/scripts/dev/auto-push.log
```

Steht dort nichts, hat es schlicht nie etwas zu tun gegeben. Das Skript
protokolliert nur, wenn es gepusht hat oder etwas im Weg stand.

## Abschalten

```bash
launchctl unload ~/Library/LaunchAgents/ai.stockpilot.autopush.plist
```

Wieder an: `launchctl load` mit demselben Pfad.

## Was der Agent bewusst *nicht* tut

Ein Hintergrunddienst, der Dinge auf ein fremdes System schiebt, sollte
zurückhaltend sein. Vier Grenzen sind fest eingebaut:

**Er committet nichts.** Nur was bereits committet ist, wird gepusht. Was der
Agent hochlädt, hat vorher jemand bewusst festgeschrieben.

**Er pusht nicht auf `main`.** Ein automatischer Push auf den Produktionsbranch
ist keine Bequemlichkeit, sondern ein Risiko — dort hängt das Deployment dran.
Der Agent steigt sofort aus, wenn `main` ausgecheckt ist.

**Er wartet bei unsauberem Arbeitsverzeichnis.** Nicht committete Änderungen
heißen: es wird gerade gearbeitet. Ein halbfertiger Stand soll nicht durch
einen Zeitgeber nach oben rutschen.

**Er löst keine Konflikte.** Ist die Gegenseite weitergelaufen, schlägt der
Push fehl und das steht im Protokoll. Ein automatischer Rebase oder Merge im
Hintergrund kann Arbeit zerstören — diese Entscheidung bleibt beim Menschen.

Kein `--force`, kein `--all`, immer nur der aktuelle Branch.

## Wenn im Protokoll ein Fehlschlag steht

Fast immer ist die Gegenseite weitergelaufen. Dann von Hand:

```bash
cd ~/Documents/PWA-Akti && git pull --rebase && git push
```
