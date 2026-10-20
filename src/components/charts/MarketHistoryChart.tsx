import { useEffect, useState } from 'react'
import type { PricePoint } from '../../types'
import { getDailyHistory } from '../../lib/marketData'
import { StockPriceChart } from './StockPriceChart'

type LoadState = 'loading' | 'ready' | 'error'

export function MarketHistoryChart({ symbol }: { symbol: string }) {
  const [state, setState] = useState<LoadState>('loading')
  const [points, setPoints] = useState<PricePoint[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    getDailyHistory(symbol).then((history) => {
      if (!active) return
      setPoints(history)
      setState('ready')
    }).catch((cause: unknown) => {
      if (!active) return
      setMessage(cause instanceof Error ? cause.message : 'Market history is temporarily unavailable.')
      setState('error')
    })
    return () => { active = false }
  }, [symbol])

  if (state === 'loading') {
    return <section className="panel chart-panel" aria-label={symbol + ' price'}>
      <div className="panel-heading"><div><h2>{symbol} price</h2><p>Loading daily closing prices…</p></div></div>
    </section>
  }
  if (state === 'error') {
    return <section className="panel chart-panel" aria-label={symbol + ' price'}>
      <div className="panel-heading"><div><h2>{symbol} price</h2><p>Daily closing prices · USD per share</p></div></div>
      <p className="chart-empty" role="alert">Market data unavailable: {message}</p>
    </section>
  }
  return <StockPriceChart symbol={symbol} data={points} />
}
