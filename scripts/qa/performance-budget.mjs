import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const chunksDir = ".next/static/chunks";
const maxJavaScriptBytes = Number(process.env.STOCKPILOT_JS_BUDGET_BYTES) || 2 * 1024 * 1024;
let bytes = 0;
let files = 0;

function visit(path) {
  for (const entry of readdirSync(path)) {
    const absolute = join(path, entry);
    const stat = statSync(absolute);
    if (stat.isDirectory()) visit(absolute);
    else if (entry.endsWith(".js")) {
      bytes += readFileSync(absolute).byteLength;
      files += 1;
    }
  }
}

visit(chunksDir);
const report = { files, bytes, kib: Number((bytes / 1024).toFixed(1)), budgetBytes: maxJavaScriptBytes, withinBudget: bytes <= maxJavaScriptBytes };
console.log(JSON.stringify(report, null, 2));
if (!report.withinBudget) process.exit(1);
