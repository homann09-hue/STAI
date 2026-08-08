import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      "server-only": new URL("./tests/stubs/server-only.ts", import.meta.url).pathname
    }
  },
  test: {
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      // `all: true` ist entscheidend: ohne diese Option zaehlt v8 nur Dateien,
      // die ein Test tatsaechlich importiert. Der Report umfasste dadurch 26
      // von rund 200 Quelldateien und meldete 88 % fuer etwa 5 % der Codebasis.
      all: true,
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/**/*.d.ts",
        "src/app/**/layout.tsx",
        "src/app/**/manifest.ts",
        "src/lib/mock/**"
      ],
      // Kalibriert am 2026-08-08 gegen einen vollstaendigen Lauf ueber alle 181
      // Quelldateien. Gemessen wurde:
      //   lines 26.33 | statements 25.51 | functions 25.63 | branches 26.33
      //
      // Die Schwellen liegen knapp darunter: sie fangen eine Verschlechterung
      // ab, ohne bei jeder kleinen Aenderung rot zu werden. Beim Anheben der
      // Abdeckung mitziehen.
      //
      // Zur Einordnung: vor `all: true` meldete derselbe Report 88 % — gemessen
      // an 26 von 181 Dateien. Der Sprung nach unten ist keine Verschlechterung,
      // sondern das Ende einer Fehlmessung.
      thresholds: {
        statements: 24,
        branches: 25,
        functions: 24,
        lines: 25
      }
    }
  }
});
