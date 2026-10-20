// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WatchlistPanel } from './WatchlistPanel'

vi.mock('../../lib/quoteCache', () => ({
  getCachedQuote: vi.fn(async (symbol: string) => ({
    symbol, price: 342.94, currency: 'USD', asOf: '2026-10-19T00:00:00.000Z',
  })),
}))

afterEach(() => cleanup())

describe('watchlist controls', () => {
  it('shows latest available daily close and trading date for a followed stock', async () => {
    render(<WatchlistPanel
      items={[{ userId: 'bob', symbol: 'AAPL' }]}
      onAdd={vi.fn()}
      onRemove={vi.fn()}
    />)
    expect(await screen.findByLabelText('AAPL daily close $342.94 as of Oct 19, 2026')).toBeInTheDocument()
  })

  it('submits uppercase symbols through the persistent add handler', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn().mockResolvedValue(undefined)
    const onRemove = vi.fn().mockResolvedValue(undefined)
    render(<WatchlistPanel items={[]} onAdd={onAdd} onRemove={onRemove} />)

    await user.type(screen.getByRole('textbox', { name: 'Stock symbol to follow' }), 'aapl')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(onAdd).toHaveBeenCalledWith('AAPL')
    expect(screen.getByRole('textbox', { name: 'Stock symbol to follow' })).toHaveValue('')
  })

  it('removes a selected symbol without clearing the other watchlist items', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn().mockResolvedValue(undefined)
    render(<WatchlistPanel
      items={[{ userId: 'bob', symbol: 'AAPL' }, { userId: 'bob', symbol: 'MSFT' }]}
      onAdd={vi.fn()}
      onRemove={onRemove}
    />)

    await user.click(screen.getByRole('button', { name: 'Remove AAPL from watchlist' }))

    expect(onRemove).toHaveBeenCalledWith('AAPL')
    expect(screen.getByText('MSFT')).toBeInTheDocument()
  })

  it('refuses to add the same symbol twice', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn().mockResolvedValue(undefined)
    render(<WatchlistPanel
      items={[{ userId: 'bob', symbol: 'AAPL' }]}
      onAdd={onAdd}
      onRemove={vi.fn()}
    />)

    await user.type(screen.getByRole('textbox', { name: 'Stock symbol to follow' }), 'AAPL')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(screen.getByRole('alert')).toHaveTextContent('already on your watchlist')
    expect(onAdd).not.toHaveBeenCalled()
  })
})
