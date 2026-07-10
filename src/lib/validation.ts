import { z } from "zod";

const unsafeTextPattern = /[\u0000-\u001F\u007F]|<[a-z!/]|on\w+\s*=|javascript:/iu;

const safeTextSchema = (maxLength: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maxLength)
    .refine((value) => !unsafeTextPattern.test(value), "Text enthält ungültige Zeichen");

export const symbolSchema = z
  .string()
  .trim()
  .min(1, "Symbol fehlt")
  .max(18, "Symbol ist zu lang")
  .regex(/^[A-Za-z0-9.-]+$/, "Symbol enthält ungültige Zeichen")
  .transform((value) => value.toUpperCase());

export const alertInputSchema = z.object({
  symbol: symbolSchema,
  type: z.enum([
    "price",
    "rsi",
    "news",
    "volume",
    "earnings",
    "ai-risk",
    "ai-shift",
    "portfolio-risk"
  ]),
  label: safeTextSchema(80),
  condition: safeTextSchema(180),
  enabled: z.boolean().optional().default(true),
  threshold: z.number().min(-1_000_000_000).max(1_000_000_000).optional(),
  frequency: z.enum(["manual", "10s", "30s", "60s", "5min"]).optional().default("manual"),
  notificationChannel: z.enum(["none", "in_app", "email", "push", "webhook"]).optional().default("none")
});

export const portfolioTradeInputSchema = z.object({
  symbol: symbolSchema,
  name: safeTextSchema(120).optional(),
  side: z.enum(["buy", "sell"]),
  assetType: z.enum(["stock", "etf", "crypto", "forex", "index"]),
  sector: safeTextSchema(80),
  quantity: z.number().positive().max(1_000_000),
  price: z.number().positive().max(10_000_000),
  currency: z.string().trim().length(3).default("USD"),
  riskScore: z.number().min(0).max(100).default(55)
});

export const portfolioDeleteInputSchema = z.object({
  id: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9._:-]+$/, "ID enthält ungültige Zeichen")
});

export const alertUpdateInputSchema = z.object({
  id: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9._:-]+$/, "ID enthält ungültige Zeichen"),
  enabled: z.boolean()
});

export const watchlistInputSchema = z.object({
  symbol: symbolSchema,
  assetType: z.enum(["stock", "etf", "crypto", "forex", "index"]).default("stock")
});

export function safeDecodeURIComponent(input: string) {
  try {
    return decodeURIComponent(input);
  } catch {
    return input;
  }
}

export function validateSymbol(input: string) {
  return symbolSchema.safeParse(safeDecodeURIComponent(input));
}

export function normalizeSymbolInput(input: string) {
  const parsed = validateSymbol(input);

  if (!parsed.success) {
    return {
      ok: false as const,
      message: sanitizeError(parsed.error)
    };
  }

  return {
    ok: true as const,
    symbol: parsed.data
  };
}

export function sanitizeError(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => issue.message).join(", ");
  }

  return "Anfrage konnte nicht verarbeitet werden.";
}
