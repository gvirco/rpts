import { describe, expect, it } from 'vitest'
import { isValidStockSymbol } from './stockSymbols'

describe('tradable and watchlist stock symbols', () => {
  it('accepts TSLA and other valid provider-compatible tickers', () => {
    for (const symbol of ['TSLA', 'AAPL', 'MSFT', 'NVDA', 'AMZN', 'BRK.B', 'ABC-DEF']) {
      expect(isValidStockSymbol(symbol)).toBe(true)
    }
  })

  it('rejects invalid or overlong symbols consistently', () => {
    for (const symbol of ['', '1ABC', 'AAPL;DROP', 'ABCDEFGHIJK', '$TSLA']) {
      expect(isValidStockSymbol(symbol)).toBe(false)
    }
  })
})
