import type { PortfolioSnapshot } from '../../types'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartFrame } from './ChartFrame'
import { formatChartDate, formatUsd } from './formatters'

export function PortfolioValueChart({ data }: { data: PortfolioSnapshot[] }) {
  const lastUpdated = data.at(-1)?.timestamp
  return <ChartFrame title="Portfolio value" subtitle="Total account value · USD" lastUpdated={lastUpdated} empty={data.length === 0}>
    <div className="chart-plot"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 12, right: 14, bottom: 2, left: 0 }}>
      <CartesianGrid stroke="#edf1ed" vertical={false} />
      <XAxis dataKey="timestamp" tickFormatter={(value: string) => formatChartDate(value)} tickLine={false} axisLine={false} minTickGap={26} />
      <YAxis tickFormatter={(value: number) => formatUsd(value)} tickLine={false} axisLine={false} width={68} domain={['auto', 'auto']} />
      <Tooltip labelFormatter={(value) => formatChartDate(String(value), true)} formatter={(value) => [formatUsd(Number(value)), 'Portfolio value']} contentStyle={{ borderRadius: 7, borderColor: '#e5ebe6', fontSize: 11 }} />
      <Line type="monotone" dataKey="totalValue" name="Portfolio value" stroke="#5485a0" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#5485a0', stroke: '#fff', strokeWidth: 2 }} />
    </LineChart></ResponsiveContainer></div>
  </ChartFrame>
}
