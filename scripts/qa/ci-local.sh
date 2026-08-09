#!/usr/bin/env bash
#
# Die vollständige CI-Kette lokal — in derselben Reihenfolge wie
# `.github/workflows/ci.yml`.
#
# Warum es dieses Skript gibt: die CI war sechs Commits lang rot, ohne dass es
# auffiel. Geprüft wurden vorher nur Typecheck, Lint auf `src`, die Tests und
# der Build — also vier von dreizehn Schritten. Die beiden Gates, die
# fehlschlugen, gehörten zu den anderen neun:
#
#   - `format:check` fand nachlaufende Leerzeichen in `mock/market.ts`
#   - `qa:grammar` fand ein „fuer" statt „für" in `scoring.ts`
#
# Beides Kleinigkeiten. Der Fehler war nicht ihre Größe, sondern dass sechsmal
# „alles grün" gemeldet wurde, während der Build auf GitHub rot stand.
#
# Aufruf:  bash scripts/qa/ci-local.sh
#
set -uo pipefail

failed=0

step() {
  local name="$1"
  shift
  printf '\n\033[1m== %s\033[0m\n' "$name"

  if "$@"; then
    printf '\033[32m   bestanden\033[0m\n'
  else
    printf '\033[31m   FEHLGESCHLAGEN\033[0m\n'
    failed=$((failed + 1))
  fi
}

step "Format hygiene"          npm run --silent format:check
step "TypeScript"              npm run --silent typecheck
step "ESLint (gesamtes Repo)"  npm run --silent lint
step "Unit tests + Coverage"   npm run --silent test:coverage
step "Production build"        npm run --silent build
step "Performance-Budget"      npm run --silent performance:budget
step "Enterprise readiness"    npm run --silent enterprise:check -- --local-only
step "Grammatik und Wortwahl"  npm run --silent qa:grammar
step "Abhängigkeiten (Audit)"  npm run --silent audit:moderate
step "Abhängigkeiten (Lizenz)" npm run --silent audit:licenses
step "Evidence und SBOM"       npm run --silent evidence:generate
step "Institutional controls"  npm run --silent institutional:check

printf '\n'

if [ "$failed" -gt 0 ]; then
  printf '\033[31m%s Schritt(e) fehlgeschlagen. Nicht pushen.\033[0m\n' "$failed"
  exit 1
fi

printf '\033[32mAlle Schritte bestanden — das ist derselbe Umfang wie die CI.\033[0m\n'
