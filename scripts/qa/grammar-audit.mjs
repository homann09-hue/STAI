import { readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = process.cwd();
const files = [
  "src/components/AppShell.tsx",
  "src/components/dashboard-view.tsx",
  "src/components/dashboard-command-grid.tsx",
  "src/components/capital-command-center.tsx",
  "src/components/asset-decision-panel.tsx",
  "src/components/investor-mode-dock.tsx",
  "src/components/asset-detail-view.tsx",
  "src/components/portfolio-view.tsx",
  "src/components/alerts-view.tsx",
  "src/components/analysis-panels.tsx",
  "src/components/learn-view.tsx",
  "src/components/pricing-view.tsx",
  "src/components/news-list.tsx",
  "src/app/layout.tsx",
  "src/app/manifest.ts",
  "src/app/offline/page.tsx",
  "src/app/not-found.tsx",
  "src/lib/scoring.ts",
  "src/lib/mock/market.ts",
  "README.md"
];

const blockedFragments = [
  "Anlageberatung versprechen",
  "sichere Gewinne",
  "sichere Signale",
  "garantiert",
  "risikofrei",
  "kaufen",
  "verkaufen"
];

const umlautSmokeWords = ["für", "können", "Prüfung", "Einschätzung", "Datenqualität"];
const combined = files.map((file) => readFileSync(join(projectRoot, file), "utf8")).join("\n");
const missingUmlauts = umlautSmokeWords.filter((word) => !combined.includes(word));
const blocked = blockedFragments.filter((fragment) => combined.toLowerCase().includes(fragment.toLowerCase()));
const suspiciousAsciiGerman = [
  "fuer",
  "koennen",
  "durfen",
  "fur",
  "Pruefung",
  "Prufung",
  "Einschaetzung",
  "Einschatzung",
  "Einschatzungen",
  "Datenqualitaet",
  "Gebuhren",
  "Gebuhreneinnahmen",
  "Zuflusse",
  "wahrend",
  "Ruckschlag",
  "erhohen",
  "Aktivitat",
  "Umsatze",
  "Volatilitat",
  "Sensitivitat",
  "schwacht",
  "gegenuber",
  "lauft",
  "seitwarts",
  "Liquiditat",
  "Ungueltig",
  "Ubersicht",
  "Luecke",
  "luecke",
  "luecken",
  "zurueck"
].filter((fragment) => combined.includes(fragment));

console.log("Grammar / wording audit");
console.log({ missingUmlauts, blocked, suspiciousAsciiGerman });

if (missingUmlauts.length || blocked.length || suspiciousAsciiGerman.length) {
  process.exit(1);
}
