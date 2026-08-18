#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const repoRoot = process.cwd();
const sourceRoots = ["src/lib", "src/app/api"];
const allowedRawFetchFiles = new Map([
  ["src/lib/providers/http-json.ts", "zentraler externer Provider-Egress"],
  ["src/lib/server-cache.ts", "serverseitiger Shared-Cache-Adapter"],
  ["src/lib/supabase/client-fetch.ts", "deduplizierter Supabase-Transport"],
  ["src/lib/billing/client.ts", "interner Browser-zu-API-Transport"],
  ["src/lib/use-market-stream.ts", "interner Browser-zu-API-Fallback"],
]);
const violations = [];
const observedFetches = [];

function relativePath(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

function listSourceFiles(directory, files = []) {
  if (!existsSync(directory)) return files;

  for (const entry of readdirSync(directory)) {
    const fullPath = path.join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      listSourceFiles(fullPath, files);
      continue;
    }

    if (!/\.(?:ts|tsx)$/.test(entry) || /\.(?:test|spec)\.[^.]+$/.test(entry)) {
      continue;
    }
    files.push(fullPath);
  }

  return files;
}

function isFetchExpression(expression) {
  if (ts.isIdentifier(expression)) return expression.text === "fetch";
  return ts.isPropertyAccessExpression(expression) && expression.name.text === "fetch";
}

function scanFile(filePath) {
  const relative = relativePath(filePath);
  const source = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    relative,
    source,
    ts.ScriptTarget.Latest,
    true,
    relative.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  function visit(node) {
    if (ts.isCallExpression(node) && isFetchExpression(node.expression)) {
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      observedFetches.push({ file: relative, line });
      if (!allowedRawFetchFiles.has(relative)) {
        violations.push({
          rule: "raw-provider-fetch",
          file: relative,
          line,
          detail: "Direkter fetch-Aufruf außerhalb einer freigegebenen Transportgrenze.",
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (/newsapi\.org[^\n]*[?&](?:api[_-]?key|apikey|token)=/i.test(source)) {
    violations.push({
      rule: "newsapi-secret-in-url",
      file: relative,
      line: 1,
      detail: "NewsAPI-Authentifizierung darf nicht in einer URL stehen.",
    });
  }
}

for (const root of sourceRoots) {
  for (const filePath of listSourceFiles(path.join(repoRoot, root))) {
    scanFile(filePath);
  }
}

for (const [relative, reason] of allowedRawFetchFiles) {
  if (!existsSync(path.join(repoRoot, relative))) {
    violations.push({
      rule: "missing-egress-boundary",
      file: relative,
      line: 1,
      detail: `Freigegebene Transportgrenze fehlt: ${reason}.`,
    });
  }
}

const httpJsonPath = path.join(repoRoot, "src/lib/providers/http-json.ts");
const httpJson = existsSync(httpJsonPath)
  ? readFileSync(httpJsonPath, "utf8")
  : "";
if (!httpJson.includes('"x-api-key"')) {
  violations.push({
    rule: "newsapi-header-boundary",
    file: "src/lib/providers/http-json.ts",
    line: 1,
    detail: "Der zentrale Transport erlaubt den serverseitigen X-Api-Key-Header nicht.",
  });
}

console.table(
  observedFetches.map((item) => ({
    ...item,
    boundary: allowedRawFetchFiles.get(item.file) ?? "NICHT FREIGEGEBEN",
  })),
);

if (violations.length > 0) {
  console.table(violations);
  console.error(
    `Provider boundary gate failed with ${violations.length} violation(s).`,
  );
  process.exit(1);
}

console.log(
  `Provider boundary gate passed: ${observedFetches.length} raw fetch call(s) are confined to ${allowedRawFetchFiles.size} reviewed transports.`,
);
