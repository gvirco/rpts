/**
 * RPTS protected order endpoint (Issue #7).
 *
 * POST { symbol: "AAPL", side: "BUY" | "SELL", quantity: 1 }
 * The browser never submits userId or price. Auth is enforced by withSupabase.
 *
 * Temporary test quotes must be explicitly enabled through the Edge Function
 * secret RPTS_USE_TEST_QUOTES=true. Replace getExecutionPrice() with the real
 * server-side market quote adapter in Issue #8 (from Issue #5).
 */
import { withSupabase } from 'npm:@supabase/server@^1'

type OrderPayload = { symbol: string; side: 'BUY' | 'SELL'; quantity: number }

const TEST_PRICES_USD: Readonly<Record<string, number>> = {
  AAPL: 100,
  MSFT: 200,
  NVDA: 150,
}

async function getExecutionPrice(symbol: string): Promise<number | null> {
  // Only for testing! Do not ship final MVP with hardcoded prices.
  if (Deno.env.get('RPTS_USE_TEST_QUOTES') === 'true') {
    return TEST_PRICES_USD[symbol] ?? null
  }

  // TODO #8: integrate server-side quote provider created in #5.
  return null
}

function validateOrder(value: unknown): OrderPayload | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>

  if (typeof v.symbol !== 'string' || typeof v.side !== 'string') return null
  const symbol = v.symbol.trim().toUpperCase()
  const side = v.side.toUpperCase()
  const quantity = v.quantity

  if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol)) return null
  if (side !== 'BUY' && side !== 'SELL') return null
  if (typeof quantity !== 'number' || !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 10000) return null

  return { symbol, side, quantity }
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    const authenticatedUserId = ctx.userClaims?.id
    if (!authenticatedUserId) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const order = validateOrder(body)
    if (!order) {
      return Response.json(
        { error: 'Specify a valid symbol, BUY/SELL side and positive whole-share quantity' },
        { status: 400 },
      )
    }

    const executionPrice = await getExecutionPrice(order.symbol)
    if (executionPrice === null) {
      return Response.json(
        { error: 'Server-side quote unavailable; connect market data API or enable test quotes' },
        { status: 503 },
      )
    }

    const { data, error } = await ctx.supabaseAdmin.rpc('execute_paper_trade', {
      p_user_id: authenticatedUserId,
      p_symbol: order.symbol,
      p_side: order.side,
      p_quantity: order.quantity,
      p_execution_price: executionPrice,
    })

    if (error) {
      if (/Insufficient cash|Insufficient shares|Invalid stock symbol|Invalid execution price|Quantity must|Trade side must/i.test(error.message)) {
        return Response.json({ error: error.message }, { status: 400 })
      }
      console.error('Trading RPC failed:', error.code)
      return Response.json({ error: 'Could not execute trade' }, { status: 500 })
    }

    return Response.json({ ...data, priceSource: 'test-only' })
  }),
}
