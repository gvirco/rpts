/**
 * Refresh a user's stored portfolio valuation with latest available daily closes.
 * Authentication is checked by withSupabase; market prices come from the server.
 * The browser cannot supply a user ID, stock price or cash balance.
 */
import { withSupabase } from 'npm:@supabase/server@^1'

const MIN_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000
const MAX_QUOTE_AGE_DAYS = 7
const MAX_HOLDINGS = 15

function validQuote(value: unknown, symbol: string): value is { symbol: string; price: number; currency: 'USD'; asOf: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const quote = value as Record<string, unknown>
  if (quote.symbol !== symbol || quote.currency !== 'USD' ||
    typeof quote.price !== 'number' || !Number.isFinite(quote.price) ||
    quote.price <= 0 || quote.price > 1000000 ||
    typeof quote.asOf !== 'string' || !/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(quote.asOf)) return false
  const age = (Date.now() - Date.parse(quote.asOf)) / 86_400_000
  return Number.isFinite(age) && age >= -1 && age <= MAX_QUOTE_AGE_DAYS
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }
    const userId = ctx.userClaims?.id
    if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 })

    // Keep provider traffic modest; daily closes do not change intraday.
    const { data: previous, error: previousError } = await ctx.supabaseAdmin
      .from('portfolio_snapshots').select('timestamp')
      .eq('user_id', userId).order('timestamp', { ascending: false })
      .limit(1).maybeSingle()
    if (previousError) return Response.json({ error: 'Could not read portfolio snapshot' }, { status: 500 })
    if (previous && Date.now() - Date.parse(previous.timestamp) < MIN_REFRESH_INTERVAL_MS) {
      return Response.json({ refreshed: false, reason: 'recent-snapshot' })
    }

    const { data: positions, error: positionsError } = await ctx.supabaseAdmin
      .from('positions').select('symbol').eq('user_id', userId).limit(MAX_HOLDINGS + 1)
    if (positionsError) return Response.json({ error: 'Could not read holdings' }, { status: 500 })
    if (!positions?.length) return Response.json({ refreshed: false, reason: 'no-holdings' })
    if (positions.length > MAX_HOLDINGS) {
      return Response.json({ error: 'Too many holdings for automatic daily refresh' }, { status: 422 })
    }

    const prices: Record<string, number> = {}
    for (const holding of positions) {
      // Service role credentials remain inside Supabase; no provider key in browser.
      const { data: quote, error } = await ctx.supabaseAdmin.functions.invoke('market-data', {
        body: { symbol: holding.symbol, type: 'quote' },
      })
      if (error || !validQuote(quote, holding.symbol)) {
        return Response.json({
          error: 'Quote unavailable for ' + holding.symbol + '; portfolio valuation unchanged',
        }, { status: 503 })
      }
      prices[holding.symbol] = Math.round(quote.price * 10000) / 10000
    }

    const { data, error } = await ctx.supabaseAdmin.rpc('refresh_paper_portfolio', {
      p_user_id: userId,
      p_prices: prices,
    })
    if (error) {
      console.error('Valuation RPC failed:', error.code)
      return Response.json({ error: 'Could not persist portfolio valuation' }, { status: 500 })
    }

    return Response.json({ refreshed: true, ...data })
  }),
}
