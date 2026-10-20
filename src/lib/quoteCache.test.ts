import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getLatestQuote } from './marketData'
import { getCachedQuote } from './quoteCache'

vi.mock('./marketData', () => ({ getLatestQuote: vi.fn() }))
const request = vi.mocked(getLatestQuote)

const quote = (symbol: string) => ({
  symbol, price: 342.94, currency: 'USD' as const, asOf: '2026-10-19T00:00:00.000Z',
})

describe('quote cache', () => {
  beforeEach(() => vi.resetAllMocks())
  afterEach(() => vi.useRealTimers())

  it('deduplicates concurrent and repeated requests for the same symbol', async () => {
    request.mockResolvedValue(quote('AAPL'))
    const [first, second] = await Promise.all([getCachedQuote('aapl'), getCachedQuote('AAPL')])
    expect(first).toEqual(quote('AAPL'))
    expect(second).toEqual(first)
    await getCachedQuote(' AAPL ')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('does not cache a quote failure', async () => {
    request.mockRejectedValueOnce(new Error('rate limited'))
      .mockResolvedValueOnce(quote('MSFT'))
    await expect(getCachedQuote('MSFT')).rejects.toThrow('rate limited')
    await expect(getCachedQuote('MSFT')).resolves.toEqual(quote('MSFT'))
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('refreshes a quote after ten minutes', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-20T18:00:00.000Z'))
    request.mockResolvedValueOnce(quote('NVDA'))
      .mockResolvedValueOnce({ ...quote('NVDA'), price: 400 })
    await getCachedQuote('NVDA')
    vi.setSystemTime(new Date('2026-10-20T18:11:00.000Z'))
    await expect(getCachedQuote('NVDA')).resolves.toMatchObject({ price: 400 })
    expect(request).toHaveBeenCalledTimes(2)
  })
})
