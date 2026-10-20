// Match the server-side market-data and execute-trade symbol constraints.
// A syntactically valid ticker still requires a quote from the data provider.
export const stockSymbolPattern = /^[A-Z][A-Z0-9.-]{0,9}$/

export function isValidStockSymbol(symbol: string): boolean {
  return stockSymbolPattern.test(symbol)
}
