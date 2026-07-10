import { readFileSync } from "node:fs";

const lock = JSON.parse(readFileSync(new URL("../../package-lock.json", import.meta.url), "utf8"));
const direct = new Set([
  ...Object.keys(lock.packages?.[""]?.dependencies ?? {}),
  ...Object.keys(lock.packages?.[""]?.devDependencies ?? {})
]);
const reviewPattern = /(GPL|AGPL|LGPL|SSPL|BUSL|PROPRIETARY|UNKNOWN)/i;
const findings = [];

for (const [path, metadata] of Object.entries(lock.packages ?? {})) {
  if (!path.startsWith("node_modules/")) continue;
  const name = path.slice("node_modules/".length);
  const license = String(metadata.license ?? "UNKNOWN");
  if (reviewPattern.test(license)) findings.push({ name, version: metadata.version, license, direct: direct.has(name) });
}

console.log(JSON.stringify({ installedPackages: Object.keys(lock.packages ?? {}).filter((path) => path.startsWith("node_modules/")).length, reviewRequired: findings }, null, 2));
if (findings.some((finding) => finding.direct && /AGPL|SSPL|PROPRIETARY|UNKNOWN/i.test(finding.license))) process.exitCode = 1;
