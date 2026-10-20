import { useState } from 'react'
import type { FormEvent } from 'react'
import type { WatchlistItem } from '../../types'
import './WatchlistPanel.css'

interface WatchlistPanelProps {
  items: WatchlistItem[]
  onAdd: (symbol: string) => Promise<void>
  onRemove: (symbol: string) => Promise<void>
}

export function WatchlistPanel({ items, onAdd, onRemove }: WatchlistPanelProps) {
  const [symbol, setSymbol] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = symbol.trim().toUpperCase()
    if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(normalized)) {
      setError('Enter a valid stock symbol such as AAPL or MSFT.')
      return
    }
    if (items.some((item) => item.symbol === normalized)) {
      setError(`${normalized} is already on your watchlist.`)
      return
    }

    setSaving(true)
    setError('')
    try {
      await onAdd(normalized)
      setSymbol('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save stock to watchlist.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(symbolToRemove: string) {
    setSaving(true)
    setError('')
    try {
      await onRemove(symbolToRemove)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove stock from watchlist.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="panel watchlist-panel">
    <div className="panel-heading">
      <div><h2>Watchlist</h2><p>Stocks you're following · saved to your account</p></div>
      <span className="watchlist-heading-star" aria-hidden="true">☆</span>
    </div>
    {items.length > 0
      ? <div className="watchlist-list">{items.map((item) =>
          <div className="watch-row" key={item.symbol}>
            <span className={`asset-icon asset-${item.symbol.toLowerCase()}`}>{item.symbol.slice(0, 1)}</span>
            <div className="watch-name"><b>{item.symbol}</b><small>Market quote pending</small></div>
            <button
              type="button"
              className="watchlist-remove"
              onClick={() => void handleRemove(item.symbol)}
              disabled={saving}
              aria-label={`Remove ${item.symbol} from watchlist`}
              title={`Remove ${item.symbol}`}
            >×</button>
          </div>
        )}</div>
      : <div className="watchlist-empty">No stocks followed yet. Add a symbol below.</div>
    }
    <form className="watchlist-add-form" onSubmit={(event) => void handleAdd(event)}>
      <input
        className="watchlist-symbol-input"
        aria-label="Stock symbol to follow"
        value={symbol}
        onChange={(event) => { setSymbol(event.target.value.toUpperCase()); setError('') }}
        placeholder="e.g. AAPL"
        maxLength={15}
        autoComplete="off"
        disabled={saving}
      />
      <button className="watchlist-add-button" type="submit" disabled={saving || !symbol.trim()}>
        {saving ? 'Saving…' : 'Add'}
      </button>
    </form>
    {error && <p role="alert" className="watchlist-error">{error}</p>}
    <p className="watchlist-hint">Live prices will be connected after Issue #5.</p>
  </div>
}
