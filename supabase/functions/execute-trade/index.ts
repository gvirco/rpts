/**
 * RPTS protected order endpoint (Issue #7 / #8).
 *
 * POST { symbol: "AAPL", side: "BUY" | "SELL", quantity: 1 }
 * The browser never submits a user ID or execution price.
 * The server obtains the latest available daily close from market-data.
 * Orders are simulated, not routed to an exchange.
 */
import { withSupabase } from 'npm:@supabase/server@^1'

type OrderPayload = { symbol: string; side: 'BUY' | 'SELL'; quantity: number }
type DailyQuote = { symbol: string; price: number; currency: 'USD'; asOf: string }
type PriceResult =
  | { quote: DailyQuote; executionPrice: number }
  | { error: string }

// Keep a generous calendar-day window for weekends and US market holidays.
// Reject genuinely stale data rather than silently executing at old quotes.
const MAX_QUOTE_AGE_DAYS = 7

function isDailyQuote(value: unknown, symbol: string): value is DailyQuote {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const quote = value as Record<string, unknown>
  return quote.symbol === symbol &&
    quote.currency === 'USD' &&
    typeof quote.price === 'number' &&
    Number.isFinite(quote.price) &&
    quote.price > 0 &&
    typeof quote.asOf === 'string' &&
    /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(quote.asOf) &&
    !Number.isNaN(Date.parse(quote.asOf))
}

async function getExecutionQuote(
  symbol: string,
  supabaseAdmin: { functions: { invoke: (name: string, options: { body: unknown }) => Promise<{ data: unknown; error: unknown }> } },
): Promise<PriceResult> {
  try {
    // A privileged server-to-server call: the market-data Edge Function
    // accepts a secret key on apikey. Never expose that key to the frontend.
    const { data, error } = await supabaseAdmin.functions.invoke('market-data', {
      body: { symbol, type: 'quote' },
    })
    if (error) {
      console.error('Server-side market quote request failed:', error instanceof Error ? error.message : 'unknown error')
      return { error: 'Market quote unavailable. No trade was executed. Please try again later.' }
    }
    if (!isDailyQuote(data, symbol)) {
      return { error: 'Market data returned an invalid quote. No trade was executed.' }
    }

    const quoteTime = Date.parse(data.asOf)
    const ageDays = (Date.now() - quoteTime) / 86_400_000
    if (ageDays < -1 || ageDays > MAX_QUOTE_AGE_DAYS) {
      return { error: 'The latest daily price is too old to execute a paper trade. No trade was executed.' }
    }

    // The atomic DB RPC records USD prices to cent precision.
    const executionPrice = Math.round(data.price * 100) / 100
    if (!Number.isFinite(executionPrice) || executionPrice <= 0) {
      return { error: 'Market data returned an invalid execution price. No trade was executed.' }
    }

    return { quote: data, executionPrice }
  } catch (error) {
    console.error('Server-side market quote request failed:', error instanceof Error ? error.message : 'unknown error')
    return { error: 'Market quote unavailable. No trade was executed. Please try again later.' }
  }
}

function validateOrder(value: unknown): OrderPayload | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>

  if (typeof v.symbol !== 'string' || typeof v.side !== 'string') return null
  const symbol = v.symbol.trim().toUpperCase()
  const side = v.side.toUpperCase()
  const quantity = v.quantity

  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)) return null
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

    const price = await getExecutionQuote(order.symbol, ctx.supabaseAdmin)
    if ('error' in price) {
      return Response.json({ error: price.error }, { status: 503 })
    }

    const { data, error } = await ctx.supabaseAdmin.rpc('execute_paper_trade', {
      p_user_id: authenticatedUserId,
      p_symbol: order.symbol,
      p_side: order.side,
      p_quantity: order.quantity,
      p_execution_price: price.executionPrice,
    })

    if (error) {
      if (/Insufficient cash|Insufficient shares|Invalid stock symbol|Invalid execution price|Quantity must|Trade side must/i.test(error.message)) {
        return Response.json({ error: error.message }, { status: 400 })
      }
      console.error('Trading RPC failed:', error.code)
      return Response.json({ error: 'Could not execute trade' }, { status: 500 })
    }

    return Response.json({
      ...data,
      priceSource: 'alpha-vantage-daily-close',
      quoteAsOf: price.quote.asOf,
    })
  }),
}
