#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const repoRoot = process.cwd();
const apiRoot = path.join(repoRoot, "src/app/api");
const mutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const exceptions = new Map([
  [
    "src/app/api/billing/webhook/route.ts#POST",
    {
      kind: "signed_webhook",
      required: ["stripe-signature", "constructEvent", "MAX_WEBHOOK_BYTES"],
    },
  ],
  [
    "src/app/api/intelligence/ingest/route.ts#POST",
    {
      kind: "privileged_server_job",
      required: ["hasPrivilegedAccess", "parseJsonBody"],
    },
  ],
]);
const findings = [];
const handlers = [];

function relativePath(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

function listRouteFiles(directory, files = []) {
  if (!existsSync(directory)) return files;
  for (const entry of readdirSync(directory)) {
    const fullPath = path.join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) listRouteFiles(fullPath, files);
    else if (entry === "route.ts") files.push(fullPath);
  }
  return files;
}

function isExported(node) {
  return node.modifiers?.some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
  );
}

function addFinding(rule, file, method, detail) {
  findings.push({ rule, file, method, detail });
}

for (const filePath of listRouteFiles(apiRoot)) {
  const relative = relativePath(filePath);
  const source = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    relative,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  for (const statement of sourceFile.statements) {
    if (
      !ts.isFunctionDeclaration(statement) ||
      !statement.name ||
      !statement.body ||
      !isExported(statement)
    ) {
      continue;
    }

    const method = statement.name.text;
    if (!/^(?:GET|POST|PUT|PATCH|DELETE)$/.test(method)) continue;

    const key = `${relative}#${method}`;
    const body = statement.body.getText(sourceFile);
    const exception = exceptions.get(key);
    handlers.push({ file: relative, method, exception: exception?.kind ?? "none" });

    if (exception?.kind === "signed_webhook") {
      for (const required of exception.required) {
        if (!source.includes(required)) {
          addFinding(
            "unsigned-webhook-exception",
            relative,
            method,
            `Webhook-Ausnahme benötigt ${required}.`,
          );
        }
      }
    } else if (!/\brateLimit\s*\(/.test(body)) {
      addFinding(
        "missing-rate-limit",
        relative,
        method,
        "Jeder Handler außer dem signaturgeprüften Webhook braucht rateLimit().",
      );
    }

    if (!mutationMethods.has(method)) continue;

    if (exception) {
      for (const required of exception.required) {
        if (!source.includes(required)) {
          addFinding(
            "incomplete-mutation-exception",
            relative,
            method,
            `Dokumentierte Ausnahme benötigt ${required}.`,
          );
        }
      }
      continue;
    }

    if (!/\brequireSameOrigin\s*\(/.test(body)) {
      addFinding(
        "missing-same-origin",
        relative,
        method,
        "Schreibende Browser-Route braucht requireSameOrigin().",
      );
    }

    if (!/\bparseJsonBody\s*\(/.test(body)) {
      addFinding(
        "missing-body-limit",
        relative,
        method,
        "Schreibende JSON-Route braucht parseJsonBody() mit Größenlimit und Schema.",
      );
    }

    if (/\.json\s*\(/.test(body)) {
      addFinding(
        "unbounded-request-json",
        relative,
        method,
        "request.json() umgeht das zentrale Bodylimit.",
      );
    }
  }
}

console.table(handlers);

if (findings.length > 0) {
  console.table(findings);
  console.error(`API perimeter gate failed with ${findings.length} finding(s).`);
  process.exit(1);
}

console.log(
  `API perimeter gate passed: ${handlers.length} handlers, ${exceptions.size} reviewed exception(s).`,
);
