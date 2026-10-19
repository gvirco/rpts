import type { ReactNode } from 'react'
import { formatChartDate } from './formatters'

export function ChartFrame({ title, subtitle, lastUpdated, empty, children }: {
  title: string
  subtitle: string
  lastUpdated?: string
  empty: boolean
  children: ReactNode
}) {
  return <section className="panel chart-panel" aria-label={title}>
    <div className="panel-heading chart-heading"><div><h2>{title}</h2><p>{subtitle}</p></div>
      {lastUpdated && <span className="chart-updated">Updated {formatChartDate(lastUpdated, true)}</span>}
    </div>
    {empty ? <div className="chart-empty"><span className="chart-empty-mark">⌁</span><b>No data yet</b><p>Chart data will appear here when available.</p></div> : children}
  </section>
}
