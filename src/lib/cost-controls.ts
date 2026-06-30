type CostControlConfig = {
  aiStaleTtlMs: number;
  aiTtlMs: number;
  fundamentalsStaleTtlMs: number;
  fundamentalsTtlMs: number;
  newsStaleTtlMs: number;
  newsTtlMs: number;
  professionalStaleTtlMs: number;
  professionalTtlMs: number;
  quoteStaleTtlMs: number;
  quoteTtlMs: number;
  streamDefaultIntervalMs: number;
  streamMaxIntervalMs: number;
  streamMinIntervalMs: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function envNumber(name: string, fallback: number, min: number, max: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? clamp(Math.round(value), min, max) : fallback;
}

export function secondsFromMs(ms: number) {
  return Math.max(1, Math.ceil(ms / 1000));
}

export function cacheControlHeaders(ttlMs: number, staleTtlMs: number) {
  const value = `s-maxage=${secondsFromMs(ttlMs)}, stale-while-revalidate=${secondsFromMs(staleTtlMs)}`;

  return {
    "Cache-Control": value,
    "CDN-Cache-Control": value,
    "Vercel-CDN-Cache-Control": value
  };
}

export function getCostControls(): CostControlConfig {
  const streamMinIntervalMs = envNumber("STOCKPILOT_STREAM_MIN_INTERVAL_MS", 5000, 1000, 60000);
  const streamMaxIntervalMs = envNumber("STOCKPILOT_STREAM_MAX_INTERVAL_MS", 60000, streamMinIntervalMs, 300000);
  const streamDefaultIntervalMs = envNumber(
    "STOCKPILOT_STREAM_INTERVAL_MS",
    15000,
    streamMinIntervalMs,
    streamMaxIntervalMs
  );
  const quoteTtlMs = envNumber("STOCKPILOT_QUOTES_TTL_MS", 8000, 1000, 60000);

  return {
    aiStaleTtlMs: envNumber("STOCKPILOT_AI_STALE_TTL_MS", 1800000, 300000, 86400000),
    aiTtlMs: envNumber("STOCKPILOT_AI_TTL_MS", 300000, 60000, 3600000),
    fundamentalsStaleTtlMs: envNumber("STOCKPILOT_FUNDAMENTALS_STALE_TTL_MS", 86400000, 3600000, 604800000),
    fundamentalsTtlMs: envNumber("STOCKPILOT_FUNDAMENTALS_TTL_MS", 3600000, 300000, 86400000),
    newsStaleTtlMs: envNumber("STOCKPILOT_NEWS_STALE_TTL_MS", 900000, 120000, 3600000),
    newsTtlMs: envNumber("STOCKPILOT_NEWS_TTL_MS", 120000, 30000, 900000),
    professionalStaleTtlMs: envNumber("STOCKPILOT_PROFESSIONAL_STALE_TTL_MS", 600000, 120000, 3600000),
    professionalTtlMs: envNumber("STOCKPILOT_PROFESSIONAL_TTL_MS", 120000, 30000, 900000),
    quoteStaleTtlMs: envNumber("STOCKPILOT_QUOTES_STALE_TTL_MS", 90000, quoteTtlMs, 300000),
    quoteTtlMs,
    streamDefaultIntervalMs,
    streamMaxIntervalMs,
    streamMinIntervalMs
  };
}

export function getStreamIntervalMs(request: Request) {
  const controls = getCostControls();
  const { searchParams } = new URL(request.url);
  const requested = Number(searchParams.get("intervalMs") ?? searchParams.get("pollMs"));

  if (!Number.isFinite(requested)) {
    return controls.streamDefaultIntervalMs;
  }

  return clamp(Math.round(requested), controls.streamMinIntervalMs, controls.streamMaxIntervalMs);
}
