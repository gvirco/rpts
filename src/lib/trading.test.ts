import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from './supabase'
import { executePaperTrade } from './trading'

vi.mock('./supabase', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}))

const invoke = vi.mocked(supabase.functions.invoke)
const savedTrade = {
  tradeId: 'trade-1',
  symbol: 'AAPL',
  side: 'BUY' as const,
  quantity: 1,
  executionPrice: 100,
  cashBalance: 9900,
  totalValue: 10000,
  profitLoss: 0,
}

describe('secure paper trading client', () => {
  beforeEach(() => vi.resetAllMocks())

  it('sends only symbol, side and quantity to the protected Edge Function', async () => {
    invoke.mockResolvedValue({ data: savedTrade, error: null } as never)

    const result = await executePaperTrade({
      symbol: ' aapl ',
      side: 'BUY',
      quantity: 1,
    })

    expect(invoke).toHaveBeenCalledExactlyOnceWith('execute-trade', {
      body: { symbol: 'AAPL', side: 'BUY', quantity: 1 },
    })
    expect(result).toEqual(savedTrade)
  })

  it('shows the backend refusal rather than a generic network message', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: new Response(JSON.stringify({ error: 'Insufficient cash' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      },
    } as never)

    await expect(executePaperTrade({ symbol: 'AAPL', side: 'BUY', quantity: 1000 }))
      .rejects.toThrow('Insufficient cash')
  })

  it('refuses an incomplete success response to avoid an unsafe retry', async () => {
    invoke.mockResolvedValue({ data: { symbol: 'AAPL' }, error: null } as never)

    await expect(executePaperTrade({ symbol: 'AAPL', side: 'BUY', quantity: 1 }))
      .rejects.toThrow('Trade response incomplete. Check History before trying again.')
  })
})
