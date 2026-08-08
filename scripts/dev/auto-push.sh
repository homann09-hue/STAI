#!/bin/bash
# Schiebt ausstehende Commits automatisch nach GitHub.
#
# Hintergrund: Commits entstehen in einer Sandbox ohne Zugangsdaten, der Push
# muss also auf diesem Rechner laufen. Dieses Skript uebernimmt das, damit
# niemand den Befehl von Hand tippen muss.
#
# Bewusst zurueckhaltend:
#   - Es committet nichts. Nur was bereits committet ist, wird gepusht.
#   - Es pusht nur den aktuellen Branch, nie `--all`, nie mit `--force`.
#   - Es pusht **nicht**, wenn `main` ausgecheckt ist. Ein automatischer Push
#     auf den Produktionsbranch ist keine Bequemlichkeit, sondern ein Risiko.
#   - Bei nicht committeten Aenderungen tut es nichts. Ein halbfertiger Stand
#     soll nicht durch einen Zeitgeber nach oben rutschen.
#
# Aktivierung siehe scripts/dev/README-auto-push.md

set -uo pipefail

REPO="${1:-$HOME/Documents/PWA-Akti}"
LOG="$REPO/scripts/dev/auto-push.log"

log() {
  printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >>"$LOG"
}

cd "$REPO" 2>/dev/null || { log "Ordner nicht gefunden: $REPO"; exit 1; }

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)" || { log "Kein Git-Repository"; exit 1; }

# Produktionsbranch bleibt in der Hand des Menschen.
if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
  exit 0
fi

# Kein Upstream: nichts zu vergleichen, also nichts zu tun. Das Anlegen der
# Verknuepfung ist eine bewusste Entscheidung und gehoert nicht in einen
# Hintergrunddienst.
if ! git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
  exit 0
fi

git fetch --quiet origin "$BRANCH" 2>/dev/null

PENDING="$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)"
[ "$PENDING" -gt 0 ] || exit 0

# Ein unsauberes Arbeitsverzeichnis heisst: es wird gerade gearbeitet.
if [ -n "$(git status --porcelain)" ]; then
  log "$PENDING Commit(s) offen, aber Arbeitsverzeichnis nicht sauber — warte."
  exit 0
fi

if OUTPUT="$(git push 2>&1)"; then
  log "$PENDING Commit(s) auf $BRANCH gepusht."
else
  # Haeufigster Fall: die Gegenseite ist weitergelaufen. Das Skript loest das
  # nicht selbst auf -- ein automatischer Rebase oder Merge im Hintergrund
  # kann Arbeit zerstoeren.
  log "Push auf $BRANCH fehlgeschlagen: $(printf '%s' "$OUTPUT" | tr '\n' ' ' | cut -c1-300)"
fi
