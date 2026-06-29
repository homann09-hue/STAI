import { z } from "zod";

export const symbolSchema = z
  .string()
  .trim()
  .min(1, "Symbol fehlt")
  .max(18, "Symbol ist zu lang")
  .regex(/^[A-Za-z0-9.-]+$/, "Symbol enthaelt ungültige Zeichen")
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
  label: z.string().trim().min(1).max(80),
  condition: z.string().trim().min(1).max(180),
  enabled: z.boolean().optional().default(true)
});

export const portfolioTradeInputSchema = z.object({
  symbol: symbolSchema,
  name: z.string().trim().min(1).max(120).optional(),
  side: z.enum(["buy", "sell"]),
  assetType: z.enum(["stock", "etf", "crypto", "forex", "index"]),
  sector: z.string().trim().min(1).max(80),
  quantity: z.number().positive().max(1_000_000),
  price: z.number().positive().max(10_000_000),
  currency: z.string().trim().length(3).default("USD"),
  riskScore: z.number().min(0).max(100).default(55)
});

export function validateSymbol(input: string) {
  return symbolSchema.safeParse(decodeURIComponent(input));
}

export function sanitizeError(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => issue.message).join(", ");
  }

  return "Anfrage konnte nicht verarbeitet werden.";
}
