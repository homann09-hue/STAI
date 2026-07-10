import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const ignored = new Set([
  ".git",
  ".next",
  ".temp",
  ".vercel",
  "node_modules",
  "coverage",
  "playwright-report",
  "test-results",
  "ios",
  "artifacts"
]);
const textExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".md", ".sql", ".yml", ".yaml", ".css", ".html"]);
const rootFiles = new Set(["README.md", "package.json", "tsconfig.json", "next.config.ts", ".env.example"]);
const findings = [];

function visit(path) {
  for (const entry of readdirSync(path)) {
    if (ignored.has(entry)) continue;
    const absolute = join(path, entry);
    const stats = statSync(absolute);
    if (stats.isDirectory()) {
      visit(absolute);
      continue;
    }
    const rel = relative(root, absolute);
    if (!textExtensions.has(extname(entry)) && !rootFiles.has(rel)) continue;
    const content = readFileSync(absolute, "utf8");
    if (content.includes("\r\n")) findings.push(`${rel}: CRLF line endings`);
    if (!content.endsWith("\n")) findings.push(`${rel}: missing final newline`);
    content.split("\n").forEach((line, index) => {
      if (/[ \t]+$/.test(line)) findings.push(`${rel}:${index + 1}: trailing whitespace`);
    });
  }
}

visit(root);
if (findings.length) {
  console.error(findings.join("\n"));
  process.exit(1);
}
console.log("Format hygiene check passed.");
