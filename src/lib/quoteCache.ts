import type { Quote } from '../types'
import { getLatestQuote } from './marketData'

// Alpha Vantage exposes end-of-day prices. Reuse a successful quote between
// watchlist and trade screens, and deduplicate simultaneous requests.
const QUOTE_CACHE_MS = 10 * 60_000
const cache = new Map<string, { until: number; request: Promise<Quote> }>()

export function getCachedQuote(symbol: string): Promise<Quote> {
  const key = symbol.trim().toUpperCase()
  const cached = cache.get(key)
  if (cached && cached.until > Date.now()) return cached.request

  const request = getLatestQuote(key).catch((error: unknown) => {
    if (cache.get(key)?.request === request) cache.delete(key)
    throw error
  })
  cache.set(key, { until: Date.now() + QUOTE_CACHE_MS, request })
  return request
}
