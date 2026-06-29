import js from "@eslint/js";
import tseslint from "typescript-eslint";

const browserGlobals = {
  window: "readonly",
  navigator: "readonly",
  document: "readonly",
  localStorage: "readonly",
  fetch: "readonly",
  Response: "readonly",
  Request: "readonly",
  URL: "readonly",
  Headers: "readonly",
  crypto: "readonly",
  caches: "readonly",
  self: "readonly"
};

export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: browserGlobals
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn"
    }
  },
  {
    files: ["public/sw.js"],
    languageOptions: {
      globals: browserGlobals
    }
  }
];
