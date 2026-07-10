import { z } from "zod";
import {
  canonicalEventTypes,
  confirmationStatuses,
  intelligenceDirections,
  intelligenceSourceTypes,
  intelligenceTimeHorizons
} from "@/lib/intelligence/types";

const httpsUrlSchema = z
  .string()
  .url()
  .max(2048)
  .refine((value) => new URL(value).protocol === "https:", "Quellen-URL muss HTTPS verwenden");

const safeSymbolSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(1)
  .max(24)
  .regex(/^[A-Z0-9.^:_/=-]+$/, "Ungültiges Börsensymbol");

export const rawSourceEventSchema = z
  .object({
    provider: z.string().trim().min(1).max(80),
    externalId: z.string().trim().min(1).max(240),
    sourceType: z.enum(intelligenceSourceTypes),
    sourceUrl: httpsUrlSchema,
    publisher: z.string().trim().min(1).max(160),
    publishedAt: z.iso.datetime(),
    receivedAt: z.iso.datetime(),
    language: z.string().trim().min(2).max(12),
    title: z.string().trim().min(1).max(500),
    rawText: z.string().max(200_000),
    symbols: z.array(safeSymbolSchema).max(50),
    companyNames: z.array(z.string().trim().min(1).max(200)).max(50),
    metadata: z.record(z.string(), z.unknown()),
    rawPayload: z.record(z.string(), z.unknown()),
    credibilityMetadata: z
      .object({
        trustScore: z.number().min(0).max(1),
        isPrimarySource: z.boolean(),
        isOfficialSource: z.boolean(),
        confirmationHint: z.enum(confirmationStatuses).optional()
      })
      .strict()
  })
  .strict();

export const intelligenceAnalysisSchema = z
  .object({
    eventType: z.enum(canonicalEventTypes),
    summary: z.string().trim().min(1).max(1200),
    facts: z
      .array(
        z
          .object({
            statement: z.string().trim().min(1).max(800),
            sourceEvidence: z.string().trim().min(1).max(1200),
            confidence: z.number().min(0).max(1)
          })
          .strict()
      )
      .max(20),
    affectedCompanies: z
      .array(
        z
          .object({
            symbol: safeSymbolSchema,
            relationship: z.enum(["direct", "indirect", "mentioned"]),
            confidence: z.number().min(0).max(1)
          })
          .strict()
      )
      .max(20),
    sentiment: z
      .object({
        score: z.number().min(-1).max(1),
        label: z.enum(["positive", "negative", "neutral", "mixed"])
      })
      .strict(),
    impact: z
      .object({
        score: z.number().min(0).max(100),
        severity: z.enum(["low", "medium", "high", "critical"]),
        timeHorizon: z.array(z.enum(intelligenceTimeHorizons)).min(1).max(3)
      })
      .strict(),
    credibility: z
      .object({
        score: z.number().min(0).max(100),
        status: z.enum(confirmationStatuses)
      })
      .strict(),
    novelty: z
      .object({
        score: z.number().min(0).max(100),
        alreadyKnown: z.boolean()
      })
      .strict(),
    bullishFactors: z.array(z.string().trim().min(1).max(500)).max(12),
    bearishFactors: z.array(z.string().trim().min(1).max(500)).max(12),
    neutralFactors: z.array(z.string().trim().min(1).max(500)).max(12),
    uncertainties: z.array(z.string().trim().min(1).max(500)).max(12),
    reasoningSummary: z.string().trim().min(1).max(1200),
    requiresHumanReview: z.boolean()
  })
  .strict();

export const intelligenceIngestSchema = z
  .object({
    providers: z.array(z.enum(["fmp", "sec_edgar"])).min(1).max(2).default(["fmp"]),
    symbols: z.array(safeSymbolSchema).max(25).default([]),
    secEntities: z
      .array(
        z
          .object({
            cik: z.string().trim().regex(/^\d{1,10}$/).transform((value) => value.padStart(10, "0")),
            symbol: safeSymbolSchema.optional()
          })
          .strict()
      )
      .max(10)
      .default([]),
    limit: z.number().int().min(1).max(100).default(25)
  })
  .strict();

export const intelligenceFeedQuerySchema = z
  .object({
    symbol: safeSymbolSchema.optional(),
    eventType: z.enum(canonicalEventTypes).optional(),
    direction: z.enum(intelligenceDirections).optional(),
    confirmationStatus: z.enum(confirmationStatuses).optional(),
    minImpact: z.coerce.number().min(0).max(100).optional(),
    since: z.iso.datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50)
  })
  .strict();

export const intelligenceIdSchema = z.string().uuid();
