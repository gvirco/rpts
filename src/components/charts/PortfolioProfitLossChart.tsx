import type { PortfolioSnapshot } from '../../types'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartFrame } from './ChartFrame'
import { formatChartDate, formatUsd } from './formatters'

export function PortfolioProfitLossChart({ data }: { data: PortfolioSnapshot[] }) {
  const lastUpdated = data.at(-1)?.timestamp
  return <ChartFrame title="Profit & loss" subtitle="Cumulative return · USD" lastUpdated={lastUpdated} empty={data.length === 0}>
    <div className="chart-plot"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 12, right: 14, bottom: 2, left: 0 }}>
      <CartesianGrid stroke="#edf1ed" vertical={false} />
      <XAxis dataKey="timestamp" tickFormatter={(value: string) => formatChartDate(value)} tickLine={false} axisLine={false} minTickGap={26} />
      <YAxis tickFormatter={(value: number) => formatUsd(value)} tickLine={false} axisLine={false} width={68} />
      <ReferenceLine y={0} stroke="#cbd5cd" />
      <Tooltip labelFormatter={(value) => formatChartDate(String(value), true)} formatter={(value) => [formatUsd(Number(value)), 'Profit / loss']} contentStyle={{ borderRadius: 7, borderColor: '#e5ebe6', fontSize: 11 }} />
      <Bar dataKey="profitLoss" name="Profit / loss" fill="#69a27a" radius={[3, 3, 0, 0]} maxBarSize={30} />
    </BarChart></ResponsiveContainer></div>
  </ChartFrame>
}
