# GitHub und Vercel Deployment

Stand: 2026-06-29

## Harte Isolationsregel

Dieses Repository ist nur für StockPilot AI gedacht. BauPro und andere Projekte dürfen weder verlinkt, deployed, gestoppt noch in Workflows referenziert werden.

Vor jedem GitHub- oder Vercel-Schritt prüfen:

```bash
pwd
# Muss sein: /Users/angelo/Documents/PWA-Akti
```

## GitHub vorbereiten

1. Neues GitHub-Repository nur für StockPilot AI erstellen.
2. Remote in diesem Ordner setzen, nicht in BauPro:

```bash
git remote add origin git@github.com:<owner>/stockpilot-ai.git
git push -u origin main
```

3. GitHub Actions laufen dann automatisch über `.github/workflows/ci.yml`.
4. Der schwere Red-Team-Lauf ist bewusst manuell über `StockPilot Red Team` startbar.

## Vercel-Projekt vorbereiten

Empfohlene Vercel-Einstellungen:

- Project Name: `stockpilot-ai`
- Framework Preset: Next.js
- Root Directory: `.`
- Install Command: `npm ci`
- Build Command: `npm run build`
- Output Directory: `.next`
- Region: `fra1`

Wichtig: Dieses Projekt niemals mit BauPro verlinken. In Vercel muss ein separates Projekt existieren.

## Vercel Environment Variables

Für den Mock-Start reichen diese Werte:

```bash
STOCKPILOT_MARKET_PROVIDER=mock
STOCKPILOT_NEWS_PROVIDER=mock
STOCKPILOT_FUNDAMENTALS_PROVIDER=mock
STOCKPILOT_AI_PROVIDER=mock
```

Für Supabase später in Vercel setzen:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Für echte Datenanbieter später einzeln setzen:

```bash
FINNHUB_API_KEY=
ALPHA_VANTAGE_API_KEY=
POLYGON_API_KEY=
TWELVE_DATA_API_KEY=
YAHOO_FINANCE_API_KEY=
NEWS_API_KEY=
OPENAI_API_KEY=
```

Keine Secrets in Git committen. `.env.local` bleibt lokal und ist ignoriert.

## Manueller Vercel-Deploy aus GitHub Actions

Der Workflow `.github/workflows/vercel-manual.yml` läuft nur über `workflow_dispatch`. Er deployed also nicht automatisch bei jedem Push.

Benötigte GitHub Secrets, bewusst mit StockPilot-Präfix:

```bash
STOCKPILOT_VERCEL_TOKEN=
STOCKPILOT_VERCEL_ORG_ID=
STOCKPILOT_VERCEL_PROJECT_ID=
```

Optionales GitHub Repository Variable:

```bash
STOCKPILOT_VERCEL_CLI_VERSION=latest
```

Wenn du eine feste Vercel-CLI-Version pinnen willst, setze dort zum Beispiel eine konkrete Version statt `latest`.

## Lokales Vercel-Linking

Nur aus diesem Ordner ausführen:

```bash
pwd
vercel link --yes --project stockpilot-ai
vercel env pull .env.local --yes
```

Die Datei `.vercel/project.json` enthält projektbezogene IDs und sollte nicht committed werden.

## Pre-Deploy-Checkliste

- `pwd` zeigt `/Users/angelo/Documents/PWA-Akti`.
- GitHub-Remote zeigt auf das StockPilot-Repository.
- Vercel-Projekt heißt `stockpilot-ai` oder eindeutig StockPilot.
- Keine BauPro-URL, kein BauPro-Projekt und keine BauPro-Secrets in GitHub Actions oder Vercel.
- `npm run qa:redteam` ist lokal oder als manueller Workflow grün.
- Rechtlicher Hinweis bleibt sichtbar: Keine Anlageberatung.
