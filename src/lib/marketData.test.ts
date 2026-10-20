import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from './supabase'
import { getDailyHistory, getLatestQuote } from './marketData'

vi.mock('./supabase', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}))

const invoke = vi.mocked(supabase.functions.invoke)

describe('market-data Edge Function client', () => {
  beforeEach(() => vi.resetAllMocks())

  it('requests normalized daily close history from the server', async () => {
    const points = [{ timestamp: '2026-10-19T00:00:00.000Z', price: 235.2 }]
    invoke.mockResolvedValue({ data: points, error: null } as never)
    const result = await getDailyHistory(' aapl ')
    expect(invoke).toHaveBeenCalledWith('market-data', {
      body: { symbol: 'AAPL', type: 'history' },
    })
    expect(result).toEqual(points)
  })

  it('requests a latest daily quote without exposing a provider API key', async () => {
    const quote = { symbol: 'MSFT', price: 500, currency: 'USD', asOf: '2026-10-19T00:00:00.000Z' }
    invoke.mockResolvedValue({ data: quote, error: null } as never)
    await expect(getLatestQuote(' msft ')).resolves.toEqual(quote)
    expect(invoke).toHaveBeenCalledWith('market-data', {
      body: { symbol: 'MSFT', type: 'quote' },
    })
  })

  it('shows the upstream API error instead of an opaque Edge Function error', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: new Response(JSON.stringify({ error: {
          code: 'provider_rate_limited',
          message: 'The market data provider rate limit was reached. Try again later.',
        } }), { status: 429 }),
      },
    } as never)
    await expect(getDailyHistory('AAPL')).rejects.toThrow('rate limit was reached')
  })

  it('rejects malformed daily price history', async () => {
    invoke.mockResolvedValue({
      data: [{ timestamp: '2026-10-19T00:00:00.000Z', price: -1 }], error: null,
    } as never)
    await expect(getDailyHistory('AAPL')).rejects.toThrow('invalid price history')
  })

  it('rejects malformed quotes and invalid symbols', async () => {
    invoke.mockResolvedValue({
      data: { symbol: 'AAPL', price: 100, currency: 'EUR', asOf: '2026-10-19' },
      error: null,
    } as never)
    await expect(getLatestQuote('AAPL')).rejects.toThrow('invalid quote')
    await expect(getDailyHistory('AAPL;DROP')).rejects.toThrow('valid stock symbol')
    expect(invoke).toHaveBeenCalledTimes(1)
  })
})
