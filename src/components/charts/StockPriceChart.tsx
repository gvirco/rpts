import type { PricePoint } from '../../types'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartFrame } from './ChartFrame'
import { formatChartDate, formatUsd } from './formatters'

export function StockPriceChart({ data, symbol }: { data: PricePoint[]; symbol: string }) {
  // The provider returns a trading *date*, not an intraday market timestamp.
  const lastDay = data.at(-1)?.timestamp
  const tradingDate = lastDay
    ? new Date(lastDay).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    : null
  return <ChartFrame title={`${symbol} price`} subtitle={`Daily closing prices · USD per share${tradingDate ? ` · Through ${tradingDate}` : ''}`} empty={data.length === 0}>
    <div className="chart-plot"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 12, right: 14, bottom: 2, left: 0 }}>
      <CartesianGrid stroke="#edf1ed" vertical={false} />
      <XAxis dataKey="timestamp" tickFormatter={(value: string) => formatChartDate(value)} tickLine={false} axisLine={false} minTickGap={26} />
      <YAxis tickFormatter={(value: number) => formatUsd(value)} tickLine={false} axisLine={false} width={65} domain={['auto', 'auto']} />
      <Tooltip labelFormatter={(value) => formatChartDate(String(value), true)} formatter={(value) => [formatUsd(Number(value)), 'Price']} contentStyle={{ borderRadius: 7, borderColor: '#e5ebe6', fontSize: 11 }} />
      <Line type="monotone" dataKey="price" name="Price" stroke="#35805a" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#35805a', stroke: '#fff', strokeWidth: 2 }} />
    </LineChart></ResponsiveContainer></div>
  </ChartFrame>
}
