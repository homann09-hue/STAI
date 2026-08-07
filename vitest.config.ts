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
      // Bewusst niedrige Untergrenze fuer die GESAMTE Codebasis, nicht fuer die
      // getestete Teilmenge. Der Wert ist noch nicht kalibriert: nach dem
      // ersten `npm run test:coverage` den echten Messwert ablesen und die
      // Schwellen dicht darunter setzen, danach schrittweise anheben.
      thresholds: {
        statements: 10,
        branches: 35,
        functions: 15,
        lines: 10
      }
    }
  }
});
