import type { PricePoint, Quote } from '../types'
import { supabase } from './supabase'

type MarketDataType = 'quote' | 'history'

function providerMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null
  if (!('error' in error)) return null
  const detail = error.error
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object' && 'message' in detail && typeof detail.message === 'string') {
    return detail.message
  }
  return null
}

async function fetchMarketData(symbol: string, type: MarketDataType): Promise<unknown> {
  const normalized = symbol.trim().toUpperCase()
  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(normalized)) {
    throw new Error('Enter a valid stock symbol.')
  }

  const { data, error } = await supabase.functions.invoke('market-data', {
    body: { symbol: normalized, type },
  })
  if (error) {
    let message = error.message
    if (error.context instanceof Response) {
      const payload: unknown = await error.context.json().catch(() => null)
      message = providerMessage(payload) ?? message
    }
    throw new Error(message)
  }
  if (data === null || data === undefined) {
    throw new Error('Market data service returned no results.')
  }
  return data
}

/** The provider exposes daily closing prices, not intraday market ticks. */
export async function getDailyHistory(symbol: string): Promise<PricePoint[]> {
  const data = await fetchMarketData(symbol, 'history')
  if (!Array.isArray(data) || !data.every((point) =>
    point && typeof point === 'object' &&
    typeof point.timestamp === 'string' && !Number.isNaN(Date.parse(point.timestamp)) &&
    typeof point.price === 'number' && Number.isFinite(point.price) && point.price > 0
  )) {
    throw new Error('Market data service returned invalid price history.')
  }
  return data as PricePoint[]
}

export async function getLatestQuote(symbol: string): Promise<Quote> {
  const data = await fetchMarketData(symbol, 'quote')
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
    !('symbol' in data) || typeof data.symbol !== 'string' ||
    data.symbol !== symbol.trim().toUpperCase() ||
    !('price' in data) || typeof data.price !== 'number' || !Number.isFinite(data.price) || data.price <= 0 ||
    !('currency' in data) || data.currency !== 'USD' ||
    !('asOf' in data) || typeof data.asOf !== 'string' || Number.isNaN(Date.parse(data.asOf))) {
    throw new Error('Market data service returned an invalid quote.')
  }
  return data as Quote
}
