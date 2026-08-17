import { readFileSync } from "node:fs";

const root = process.cwd();
const read = (path) => readFileSync(`${root}/${path}`, "utf8");

const constitution = read("docs/ULTIMATE_MARKET_READINESS_GOAL.md");
const archivedMaster = read("docs/MASTERPROMPT.md");
const operatingCard = read("docs/OPERATING_CARD.md");
const ledger = read("docs/EXECUTION_LEDGER.md");

const requiredConstitutionMarkers = [
  "Version 4.0",
  "PHASE 0",
  "PHASE 1.1",
  "Stripe-sichere Account-Löschung",
  "BLOCKED – EXTERNAL"
];

for (const marker of requiredConstitutionMarkers) {
  if (!constitution.includes(marker)) {
    throw new Error(`Authoritative constitution is missing required marker: ${marker}`);
  }
}

if (!archivedMaster.includes("SUPERSEDED – NOT AUTHORITATIVE")) {
  throw new Error("Legacy master prompt is not explicitly marked as superseded.");
}

if (!archivedMaster.includes("docs/ULTIMATE_MARKET_READINESS_GOAL.md")) {
  throw new Error("Legacy master prompt does not link to the authoritative constitution.");
}

const markerPattern = /<!-- ACTIVE_WORKPOINT: ([A-Z0-9-]+) -->/g;
const markers = [operatingCard, ledger].map((content) => [...content.matchAll(markerPattern)].map((match) => match[1]));

if (markers.some((values) => values.length !== 1) || markers[0][0] !== markers[1][0]) {
  throw new Error("Operating Card and Execution Ledger must name exactly one identical active workpoint.");
}

console.log(`Governance check passed. Active workpoint: ${markers[0][0]}`);
