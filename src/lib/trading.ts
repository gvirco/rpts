import type { TradeOrder } from '../types'
import { supabase } from './supabase'

export interface PaperTradeResult {
  tradeId: string
  symbol: string
  side: TradeOrder['side']
  quantity: number
  executionPrice: number
  /** Trading date of the daily close; not an intraday execution timestamp. */
  quoteAsOf?: string
  priceSource?: 'alpha-vantage-daily-close' | 'test-only'
  cashBalance: number
  totalValue: number
  profitLoss: number
}

/**
 * Only the authenticated Supabase Edge Function executes paper trades.
 * Never send a browser-controlled user ID or execution price.
 */
export async function executePaperTrade(order: TradeOrder): Promise<PaperTradeResult> {
  const { data, error } = await supabase.functions.invoke('execute-trade', {
    body: {
      symbol: order.symbol.trim().toUpperCase(),
      side: order.side,
      quantity: order.quantity,
    },
  })

  if (error) {
    let message = error.message
    if (error.context instanceof Response) {
      const details: unknown = await error.context.json().catch(() => null)
      if (details && typeof details === 'object' && 'error' in details && typeof details.error === 'string') {
        message = details.error
      }
    }
    throw new Error(message)
  }

  if (!data || typeof data !== 'object' ||
      typeof data.executionPrice !== 'number' || data.executionPrice <= 0 ||
      typeof data.tradeId !== 'string') {
    throw new Error('Trade response incomplete. Check History before trying again.')
  }

  return data as PaperTradeResult
}
