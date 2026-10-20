// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getDailyHistory } from '../../lib/marketData'
import { MarketHistoryChart } from './MarketHistoryChart'

vi.mock('../../lib/marketData', () => ({ getDailyHistory: vi.fn() }))
vi.mock('./StockPriceChart', () => ({
  StockPriceChart: ({ symbol }: { symbol: string }) =>
    <section aria-label={symbol + ' price chart'}>Historical chart for {symbol}</section>,
}))

const loadHistory = vi.mocked(getDailyHistory)

beforeEach(() => vi.resetAllMocks())
afterEach(() => cleanup())

describe('selected stock price history', () => {
  it('loads AAPL by default and refreshes the chart for a selected symbol', async () => {
    const user = userEvent.setup()
    loadHistory.mockResolvedValue([{ timestamp: '2026-10-19T00:00:00.000Z', price: 342.94 }])

    render(<MarketHistoryChart symbol="AAPL" />)
    expect(await screen.findByText('Historical chart for AAPL')).toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Stock price chart symbol' }), 'MSFT')
    expect(await screen.findByText('Historical chart for MSFT')).toBeInTheDocument()
    expect(loadHistory).toHaveBeenNthCalledWith(1, 'AAPL')
    expect(loadHistory).toHaveBeenNthCalledWith(2, 'MSFT')
  })

  it('keeps the selector usable when a different symbol has no market history', async () => {
    const user = userEvent.setup()
    loadHistory.mockImplementation(async (symbol) => {
      if (symbol === 'NVDA') throw new Error('Provider rate limit reached')
      return [{ timestamp: '2026-10-19T00:00:00.000Z', price: 342.94 }]
    })

    render(<MarketHistoryChart symbol="AAPL" />)
    expect(await screen.findByText('Historical chart for AAPL')).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Stock price chart symbol' }), 'NVDA')
    expect(await screen.findByRole('alert')).toHaveTextContent('Provider rate limit reached')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Stock price chart symbol' }), 'MSFT')
    expect(await screen.findByText('Historical chart for MSFT')).toBeInTheDocument()
  })
})
