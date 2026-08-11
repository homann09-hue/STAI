import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/credentials";

const config = readFileSync(new URL("../../../supabase/config.toml", import.meta.url), "utf8");

describe("Supabase-Passwortkonfiguration", () => {
  it("erzwingt serverseitig dieselbe Mindestlänge wie die App", () => {
    expect(config).toMatch(new RegExp(`^minimum_password_length = ${MIN_PASSWORD_LENGTH}$`, "m"));
  });

  it("verlangt für spätere Passwortwechsel eine frische Anmeldung", () => {
    expect(config).toMatch(/^secure_password_change = true$/m);
  });

  it("erzwingt keine schwache Zeichenklassen-Schablone", () => {
    expect(config).toMatch(/^password_requirements = ""$/m);
  });
});
