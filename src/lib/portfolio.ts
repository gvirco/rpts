import type { PortfolioSnapshot, Position, Trade, WatchlistItem } from '../types'
import { supabase } from './supabase'

/** Load the signed-in user's persisted data, protected by Supabase RLS.
 * No client-supplied user ID is used to scope these queries.
 */
export async function getMyPortfolioData(): Promise<{
  positions: Position[]
  trades: Trade[]
  snapshots: PortfolioSnapshot[]
  watchlist: WatchlistItem[]
}> {
  const [positionsResult, tradesResult, snapshotsResult, watchlistResult] = await Promise.all([
    supabase.from('positions').select('symbol, quantity, average_cost, last_price').order('symbol'),
    supabase.from('transactions').select('id, user_id, symbol, side, quantity, price, executed_at')
      .order('executed_at', { ascending: false }).limit(200),
    supabase.from('portfolio_snapshots').select('id, user_id, timestamp, cash_balance, positions_value, total_value, profit_loss')
      .order('timestamp', { ascending: false }).limit(200),
    supabase.from('watchlist').select('user_id, symbol').order('symbol'),
  ])

  const failed = [positionsResult, tradesResult, snapshotsResult, watchlistResult].find((result) => result.error)
  if (failed?.error) throw failed.error

  return {
    positions: (positionsResult.data ?? []).map((row) => ({
      symbol: row.symbol,
      quantity: Number(row.quantity),
      averageCost: Number(row.average_cost),
      lastPrice: Number(row.last_price),
    })),
    trades: (tradesResult.data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      symbol: row.symbol,
      side: row.side as Trade['side'],
      quantity: Number(row.quantity),
      price: Number(row.price),
      executedAt: row.executed_at,
    })),
    snapshots: (snapshotsResult.data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      timestamp: row.timestamp,
      cashBalance: Number(row.cash_balance),
      positionsValue: Number(row.positions_value),
      totalValue: Number(row.total_value),
      profitLoss: Number(row.profit_loss),
    })).reverse(),
    watchlist: (watchlistResult.data ?? []).map((row) => ({
      userId: row.user_id,
      symbol: row.symbol,
    })),
  }
}

/**
 * Ask the authenticated backend to refresh stored holdings and snapshots.
 * All stock prices and the user ID are controlled by the server.
 * A recent snapshot may be reused to avoid daily market-data quota exhaustion.
 */
export async function refreshMyPortfolioValuation(): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('refresh-portfolio', {
    body: {},
  })
  if (error) throw new Error('Portfolio valuation refresh unavailable.')
  if (!data || typeof data !== 'object' || typeof data.refreshed !== 'boolean') {
    throw new Error('Portfolio valuation refresh returned an invalid response.')
  }
  return data.refreshed
}
