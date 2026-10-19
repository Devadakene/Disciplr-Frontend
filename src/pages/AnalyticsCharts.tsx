/**
 * AnalyticsCharts — lazily loaded chart subtree.
 * All recharts imports are confined to this module so the recharts vendor
 * chunk stays out of the eager Analytics bundle path.
 */
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { ReactNode, CSSProperties } from 'react'
import { ChartLegend, type ChartLegendEntry } from '../components/ChartLegend'
import type { AnalyticsSeriesColors, AnalyticsChartTokens } from './analyticsTheme'
import Skeleton from '../components/Skeleton'

// ─── Local helpers ────────────────────────────────────────────────────────────


function EmptyState({ message }: { message: string }) {
  return (
    <div
      data-testid="analytics-empty-state"
      role="status"
      style={{
        padding: '2.5rem',
        textAlign: 'center',
        color: 'var(--muted)',
        border: '1px dashed var(--border)',
        borderRadius: 'var(--radius)',
      }}
    >
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</div>
      <div style={{ fontSize: '0.9rem' }}>{message}</div>
    </div>
  )
}

function Card({ children, style = {} }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '1.5rem',
      ...style,
    }}>
      {children}
    </div>
  )
}

function ChartTitle({ children }: { children: ReactNode }) {
  return <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1.25rem 0' }}>{children}</h3>
}

function ChartSummary({ children }: { children: ReactNode }) {
  return <p className="sr-only">{children}</p>
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type PeriodRow = {
  name: string
  success: number
  failed: number
  capital: number
  milestones: number
  prevSuccess?: number
  prevCapital?: number
}

export type AnalyticsChartsProps = {
  /** Which chart island to render */
  section: 'performance' | 'donut' | 'team'
  displayData: PeriodRow[]
  chartData: PeriodRow[]
  period: string
  vaultStatusData: { name: string; value: number }[]
  teamChartData: { name: string; rate: number }[]
  showComparison: boolean
  chartAnimationEnabled: boolean
  tooltipStyle: object
  seriesColors: AnalyticsSeriesColors
  chartTokens: AnalyticsChartTokens
  successLegendEntries: ChartLegendEntry[]
  capitalLegendEntries: ChartLegendEntry[]
  isLoading: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AnalyticsCharts({
  section, displayData, chartData, period, vaultStatusData, teamChartData,
  showComparison, chartAnimationEnabled, tooltipStyle,
  seriesColors, chartTokens, successLegendEntries, capitalLegendEntries,
  isLoading,
}: AnalyticsChartsProps) {
  const hasChartData = chartData.length > 0
  const emptyMsg = `No data for this period (${period}).`

  if (section === 'performance') {
    return (
      <div className="chart-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>

        {/* Success Rate */}
        <Card>
          <ChartTitle>Success Rate Over Time</ChartTitle>
          <ChartSummary>
            Line chart summarizing success and failure percentages for the selected {period} period.
            {showComparison ? ' Previous period success rate is included for comparison.' : ''}
          </ChartSummary>
          {isLoading ? <Skeleton data-testid="chart-skeleton" /> : !hasChartData ? <EmptyState message={emptyMsg} /> : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={displayData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={seriesColors.grid} vertical={false} />
                  <XAxis dataKey="name" stroke={seriesColors.axis} tick={{ fill: seriesColors.axis, fontSize: 11 }} />
                  <YAxis stroke={seriesColors.axis} tick={{ fill: seriesColors.axis, fontSize: 11 }} unit="%" />
                  <Tooltip {...tooltipStyle} />
                  <Line type="monotone" dataKey="success" stroke={seriesColors.success} strokeWidth={2.5} dot={{ r: 3, fill: seriesColors.success }} name="This Period %" isAnimationActive={chartAnimationEnabled} />
                  <Line type="monotone" dataKey="failed" stroke={seriesColors.failed} strokeWidth={2} dot={{ r: 2, fill: seriesColors.failed }} name="Failed %" strokeDasharray="4 2" isAnimationActive={chartAnimationEnabled} />
                  {showComparison && (
                    <Line type="monotone" dataKey="prevSuccess" stroke={seriesColors.comparison} strokeWidth={1.5} dot={false} name="Prev Period %" strokeDasharray="6 3" isAnimationActive={chartAnimationEnabled} />
                  )}
                </LineChart>
              </ResponsiveContainer>
              {showComparison && (
                <ChartLegend entries={successLegendEntries} colors={seriesColors} tokens={chartTokens} />
              )}
            </>
          )}
        </Card>

        {/* Capital Locked */}
        <Card>
          <ChartTitle>Capital Locked Over Time</ChartTitle>
          <ChartSummary>
            Area chart showing USDC capital locked over the selected {period} period.
            {showComparison ? ' Previous period capital is shown as a comparison area.' : ''}
          </ChartSummary>
          {isLoading ? <Skeleton data-testid="chart-skeleton" /> : !hasChartData ? <EmptyState message={emptyMsg} /> : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={displayData}>
                  <defs>
                    <linearGradient id="capGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={seriesColors.success} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={seriesColors.success} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="prevCapGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={seriesColors.comparison} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={seriesColors.comparison} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={seriesColors.grid} vertical={false} />
                  <XAxis dataKey="name" stroke={seriesColors.axis} tick={{ fill: seriesColors.axis, fontSize: 11 }} />
                  <YAxis stroke={seriesColors.axis} tick={{ fill: seriesColors.axis, fontSize: 11 }} />
                  <Tooltip {...tooltipStyle} />
                  <Area type="monotone" dataKey="capital" stroke={seriesColors.success} strokeWidth={2.5} fill="url(#capGrad)" name="USDC Locked" isAnimationActive={chartAnimationEnabled} />
                  {showComparison && (
                    <Area type="monotone" dataKey="prevCapital" stroke={seriesColors.comparison} strokeWidth={1.5} fill="url(#prevCapGrad)" name="Prev Period" strokeDasharray="5 3" isAnimationActive={chartAnimationEnabled} />
                  )}
                </AreaChart>
              </ResponsiveContainer>
              {showComparison && (
                <ChartLegend entries={capitalLegendEntries} colors={seriesColors} tokens={chartTokens} />
              )}
            </>
          )}
        </Card>

        {/* Milestone Trend */}
        <Card>
          <ChartTitle>Milestone Completion Trend</ChartTitle>
          <ChartSummary>
            Bar chart showing completed milestone counts for each point in the selected {period} period.
          </ChartSummary>
          {isLoading ? <Skeleton data-testid="chart-skeleton" /> : !hasChartData ? <EmptyState message={emptyMsg} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={seriesColors.grid} vertical={false} />
                <XAxis dataKey="name" stroke={seriesColors.axis} tick={{ fill: seriesColors.axis, fontSize: 11 }} />
                <YAxis stroke={seriesColors.axis} tick={{ fill: seriesColors.axis, fontSize: 11 }} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="milestones" fill={seriesColors.milestone} radius={[4, 4, 0, 0]} name="Milestones Completed" isAnimationActive={chartAnimationEnabled} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

      </div>
    )
  }

  if (section === 'donut') {
    if (isLoading) return <Skeleton height={180} data-testid="chart-skeleton" />
    if (vaultStatusData.length === 0) return <EmptyState message="No data for this period." />
    return (
      <>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={vaultStatusData} innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value" isAnimationActive={chartAnimationEnabled}>
              {vaultStatusData.map((_, i) => (
                <Cell key={i} fill={seriesColors.pie[i % seriesColors.pie.length]} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem', marginTop: '0.5rem' }}>
          {vaultStatusData.map((entry, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--muted)' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: seriesColors.pie[i], display: 'inline-block' }} />
              {entry.name} ({entry.value})
            </div>
          ))}
        </div>
      </>
    )
  }

  // section === 'team'
  if (isLoading) return <Skeleton height={160} data-testid="chart-skeleton" />
  if (teamChartData.length === 0) return <EmptyState message={emptyMsg} />
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={teamChartData}>
        <XAxis dataKey="name" stroke={seriesColors.axis} tick={{ fill: seriesColors.axis, fontSize: 11 }} />
        <YAxis stroke={seriesColors.axis} tick={{ fill: seriesColors.axis, fontSize: 11 }} unit="%" />
        <Bar dataKey="rate" fill={seriesColors.success} radius={[4, 4, 0, 0]} isAnimationActive={chartAnimationEnabled} />
      </BarChart>
    </ResponsiveContainer>
  )
}
