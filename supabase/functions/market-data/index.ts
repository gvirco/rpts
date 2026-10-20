// Supabase Edge Function: normalized Alpha Vantage stock quote and daily history.
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import type { PricePoint, Quote } from "../../../src/types/index.ts";

const PROVIDER_URL = "https://www.alphavantage.co/query";
const CACHE_TTL_MS = {
  quote: 60_000,
  history: 6 * 60 * 60 * 1_000,
} as const;
const SYMBOL_PATTERN = /^[A-Z][A-Z0-9.-]{0,9}$/;

type RequestType = keyof typeof CACHE_TTL_MS;
type MarketData = Quote | PricePoint[];
type CacheEntry = { expiresAt: number; data: MarketData };

// Warm Edge Function instances share this cache; separate instances may fetch independently.
const cache = new Map<string, CacheEntry>();

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

function normalizeTradingDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return null;
  // Alpha Vantage daily endpoints expose a trading date, not an intraday timestamp.
  return parsed.toISOString();
}

function parsePositivePrice(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function fetchProviderData(type: RequestType, symbol: string, apiKey: string): Promise<MarketData> {
  const params = new URLSearchParams({
    function: type === "quote" ? "GLOBAL_QUOTE" : "TIME_SERIES_DAILY",
    symbol,
    apikey: apiKey,
  });
  const response = await fetch(`${PROVIDER_URL}?${params.toString()}`, {
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    if (response.status === 429) throw new ProviderError(429, "provider_rate_limited", "The market data provider rate limit was reached. Try again later.");
    throw new ProviderError(502, "provider_unavailable", "The market data provider could not complete the request.");
  }

  let payload: Record<string, unknown>;
  try {
    payload = await response.json() as Record<string, unknown>;
  } catch {
    throw new ProviderError(502, "invalid_provider_response", "The market data provider returned an unreadable response.");
  }

  const providerMessage = [payload.Note, payload.Information, payload["Error Message"]]
    .find((message): message is string => typeof message === "string");
  if (providerMessage) {
    const rateLimited = /call frequency|rate limit|requests per day|thank you for using alpha vantage/i.test(providerMessage);
    throw new ProviderError(rateLimited ? 429 : 502, rateLimited ? "provider_rate_limited" : "provider_error",
      rateLimited ? "The market data provider rate limit was reached. Try again later." : "The market data provider rejected the request.");
  }

  if (type === "quote") {
    const quote = payload["Global Quote"] as Record<string, unknown> | undefined;
    const providerSymbol = quote?.["01. symbol"];
    const price = parsePositivePrice(quote?.["05. price"]);
    const tradingDate = typeof quote?.["07. latest trading day"] === "string"
      ? normalizeTradingDate(quote["07. latest trading day"] as string)
      : null;

    if (!quote || providerSymbol !== symbol || price === null || !tradingDate) {
      throw new ProviderError(404, "symbol_data_unavailable", `No latest USD quote is available for ${symbol}.`);
    }

    const result: Quote = { symbol, price, currency: "USD", asOf: tradingDate };
    return result;
  }

  const series = payload["Time Series (Daily)"] as Record<string, Record<string, unknown>> | undefined;
  if (!series) throw new ProviderError(404, "history_unavailable", `No daily price history is available for ${symbol}.`);

  const points: PricePoint[] = Object.entries(series).flatMap(([date, values]) => {
    const timestamp = normalizeTradingDate(date);
    const price = parsePositivePrice(values["4. close"]);
    return timestamp && price !== null ? [{ timestamp, price }] : [];
  }).sort((left, right) => left.timestamp.localeCompare(right.timestamp));

  if (points.length === 0) throw new ProviderError(404, "history_unavailable", `No daily price history is available for ${symbol}.`);
  return points;
}

class ProviderError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req) => {
    if (req.method !== "POST") {
      return errorResponse(405, "method_not_allowed", "Use POST with a JSON request body.");
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "invalid_json", "Request body must be valid JSON.");
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return errorResponse(400, "invalid_request", "Request body must be a JSON object.");
    }

    const input = body as Record<string, unknown>;
    const unexpectedParameter = Object.keys(input).find((key) => key !== "symbol" && key !== "type");
    if (unexpectedParameter) {
      return errorResponse(400, "unexpected_parameter", `Unsupported request parameter: ${unexpectedParameter}.`);
    }
    if (typeof input.symbol !== "string" || input.symbol.trim() === "") {
      return errorResponse(400, "symbol_required", "Provide a stock symbol such as AAPL or MSFT.");
    }
    const symbol = input.symbol.trim().toUpperCase();
    if (!SYMBOL_PATTERN.test(symbol)) {
      return errorResponse(400, "invalid_symbol", "Symbol must be 1–10 letters, numbers, dots, or hyphens and start with a letter.");
    }
    if (input.type !== "quote" && input.type !== "history") {
      return errorResponse(400, "invalid_type", 'Type must be "quote" or "history".');
    }

    const apiKey = Deno.env.get("ALPHA_VANTAGE_API_KEY");
    if (!apiKey) {
      return errorResponse(503, "market_data_not_configured", "Market data is not configured on the server.");
    }

    const type: RequestType = input.type;
    const cacheKey = `${type}:${symbol}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return Response.json(cached.data, { headers: { "Cache-Control": "no-store" } });
    }
    if (cached) cache.delete(cacheKey);

    try {
      const data = await fetchProviderData(type, symbol, apiKey);
      if (cache.size >= 50) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey) cache.delete(oldestKey);
      }
      cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS[type] });
      return Response.json(data, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (error instanceof ProviderError) return errorResponse(error.status, error.code, error.message);
      if (error instanceof DOMException && error.name === "TimeoutError") {
        return errorResponse(504, "provider_timeout", "The market data provider took too long to respond.");
      }
      return errorResponse(502, "provider_unavailable", "Could not retrieve market data. Try again later.");
    }
  }),
};

/* Local invocation after `supabase start`:

  supabase secrets set ALPHA_VANTAGE_API_KEY=your_key_here

  curl --request POST 'http://127.0.0.1:54321/functions/v1/market-data' \
    --header 'Content-Type: application/json' \
    --header 'apikey: YOUR_SUPABASE_PUBLISHABLE_KEY' \
    --data '{"symbol":"AAPL","type":"quote"}'

  Change type to "history" for normalized daily PricePoint[] values.
*/
