import { useEffect, useState } from 'react'
import type { PricePoint } from '../../types'
import { getDailyHistory } from '../../lib/marketData'
import { ChartFrame } from './ChartFrame'
import { StockPriceChart } from './StockPriceChart'

type LoadState = 'loading' | 'ready' | 'error'
const chartSymbols = ['AAPL', 'MSFT', 'NVDA'] as const

export function MarketHistoryChart({ symbol }: { symbol: string }) {
  const [selectedSymbol, setSelectedSymbol] = useState(symbol)
  const [state, setState] = useState<LoadState>('loading')
  const [points, setPoints] = useState<PricePoint[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    getDailyHistory(selectedSymbol).then((history) => {
      if (!active) return
      setPoints(history)
      setState('ready')
    }).catch((cause: unknown) => {
      if (!active) return
      setMessage(cause instanceof Error ? cause.message : 'Market history is temporarily unavailable.')
      setState('error')
    })
    return () => { active = false }
  }, [selectedSymbol])

  const picker = <label className="chart-symbol-picker">
    Symbol
    <select
      aria-label="Stock price chart symbol"
      value={selectedSymbol}
      onChange={(event) => {
        const nextSymbol = event.target.value
        if (nextSymbol === selectedSymbol) return
        setPoints([])
        setMessage('')
        setState('loading')
        setSelectedSymbol(nextSymbol)
      }}
    >
      {chartSymbols.map((item) => <option value={item} key={item}>{item}</option>)}
    </select>
  </label>

  if (state === 'loading') {
    return <ChartFrame title={selectedSymbol + ' price'} subtitle="Loading daily closing prices…" headerAction={picker} empty={false}>
      <div className="chart-empty" role="status">Loading historical prices…</div>
    </ChartFrame>
  }
  if (state === 'error') {
    return <ChartFrame title={selectedSymbol + ' price'} subtitle="Daily closing prices · USD per share" headerAction={picker} empty={false}>
      <p className="chart-empty" role="alert">Market data unavailable: {message}</p>
    </ChartFrame>
  }
  return <StockPriceChart symbol={selectedSymbol} data={points} headerAction={picker} />
}
