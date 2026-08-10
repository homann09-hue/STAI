type RuntimeEnvironment = Record<string, string | undefined>;

/**
 * Entwicklungs-Fixtures duerfen niemals in einer echten Vercel-Produktion
 * erscheinen. Der explizite Testschalter ist nur fuer lokale Production-Build-
 * E2E-Laeufe gedacht; `VERCEL_ENV=production` gewinnt immer.
 */
export function developmentFixturesAllowed(env: RuntimeEnvironment = process.env) {
  if (env.VERCEL_ENV?.trim().toLowerCase() === "production") return false;

  const nodeEnv = env.NODE_ENV?.trim().toLowerCase();
  if (nodeEnv === "development" || nodeEnv === "test") return true;

  return env.STOCKPILOT_ALLOW_TEST_FIXTURES?.trim().toLowerCase() === "true";
}
