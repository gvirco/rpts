/**
 * Shared RPTS frontend/backend contracts.
 * All money values are USD amounts (e.g. 123.45), all dates are ISO 8601 UTC strings.
 * Data sent to UI is camelCase; database tables may use snake_case.
 * The server owns trade price, cash updates and position calculations.
 */

export type TradeSide = 'BUY' | 'SELL'

export interface Profile {
  userId: string
  nickname: string
  startingBalance: number
  cashBalance: number
}

export interface Quote {
  symbol: string
  price: number
  currency: 'USD'
  asOf: string // Market data timestamp, not the time the page was opened.
}

export interface PricePoint {
  timestamp: string
  price: number
}

export interface TradeOrder {
  symbol: string
  side: TradeSide
  quantity: number // Whole, positive shares; never accept a client-supplied price.
}

export interface Trade {
  id: string
  userId: string
  symbol: string
  side: TradeSide
  quantity: number
  price: number // Execution price persisted when the trade is created.
  executedAt: string
}

export interface Position {
  symbol: string
  quantity: number
  averageCost: number // Weighted-average USD cost per share.
}

export interface WatchlistItem {
  userId: string
  symbol: string
}

export interface PortfolioSnapshot {
  id: string
  userId: string
  timestamp: string
  cashBalance: number
  positionsValue: number
  totalValue: number
  profitLoss: number // totalValue - startingBalance (no deposits/withdrawals in MVP).
}
