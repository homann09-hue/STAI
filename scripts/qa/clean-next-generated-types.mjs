import { existsSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(".next/types");
let removed = 0;

function clean(path) {
  for (const entry of readdirSync(path)) {
    const absolute = join(path, entry);
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      clean(absolute);
      continue;
    }
    if (/ \d+\.ts$/.test(entry)) {
      unlinkSync(absolute);
      removed += 1;
      console.log(`Removed generated duplicate: ${relative(process.cwd(), absolute)}`);
    }
  }
}

if (existsSync(root)) clean(root);
console.log(`Generated Next.js type cleanup complete (${removed} duplicate${removed === 1 ? "" : "s"}).`);
