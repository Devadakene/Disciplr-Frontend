/**
 * analyticsKpis.ts
 *
 * Pure utility for computing KPI metrics from analytics series data.
 * Handles totals, averages, and period-over-period deltas with edge case coverage.
 */

import { formatUsdc } from './format'

export interface AnalyticsDataPoint {
  name: string
  success: number
  failed: number
  capital: number
  milestones: number
}

export interface KpiMetrics {
  /** Total USDC capital locked in the current period */
  totalCapital: number
  /** Previous period total capital (for delta calculation) */
  prevTotalCapital: number
  /** Average success rate percentage in the current period */
  averageSuccessRate: number
  /** Previous period average success rate (for delta calculation) */
  prevAverageSuccessRate: number
  /** Total milestone count in the current period */
  totalMilestones: number
  /** Previous period total milestone count (for delta calculation) */
  prevTotalMilestones: number
  /** Capital delta (current - previous); 0 if no previous data */
  capitalDelta: number
  /** Success rate delta (current - previous); 0 if no previous data */
  successDelta: number
  /** Milestone delta (current - previous); 0 if no previous data */
  milestoneDelta: number
  /** Whether to show up arrow for capital (true = positive, false = negative) */
  capitalTrend: boolean
  /** Whether to show up arrow for success rate (true = positive, false = negative) */
  successTrend: boolean
  /** Whether to show up arrow for milestones (true = positive, false = negative) */
  milestoneTrend: boolean
}

/**
 * Compute aggregate KPI metrics from a period's series data.
 *
 * @param currentData - Series data for the selected period
 * @param previousData - Series data for the previous period (optional for comparison)
 * @returns KpiMetrics object with totals, averages, and deltas
 */
export function computeAnalyticsKpis(
  currentData: AnalyticsDataPoint[],
  previousData?: AnalyticsDataPoint[],
): KpiMetrics {
  // Handle empty current data
  if (!currentData || currentData.length === 0) {
    return {
      totalCapital: 0,
      prevTotalCapital: 0,
      averageSuccessRate: 0,
      prevAverageSuccessRate: 0,
      totalMilestones: 0,
      prevTotalMilestones: 0,
      capitalDelta: 0,
      successDelta: 0,
      milestoneDelta: 0,
      capitalTrend: false,
      successTrend: false,
      milestoneTrend: false,
    }
  }

  // Current period aggregates
  const totalCapital = currentData.reduce((sum, d) => sum + (d.capital || 0), 0)
  const averageSuccessRate =
    currentData.length > 0
      ? currentData.reduce((sum, d) => sum + (d.success || 0), 0) / currentData.length
      : 0

  const totalMilestones = currentData.reduce((sum, d) => sum + (d.milestones || 0), 0)

  // Previous period aggregates (if provided)
  let prevTotalCapital = 0
  let prevAverageSuccessRate = 0
  let prevTotalMilestones = 0

  if (previousData && previousData.length > 0) {
    prevTotalCapital = previousData.reduce((sum, d) => sum + (d.capital || 0), 0)
    prevAverageSuccessRate =
      previousData.reduce((sum, d) => sum + (d.success || 0), 0) / previousData.length
    prevTotalMilestones = previousData.reduce((sum, d) => sum + (d.milestones || 0), 0)
  }

  // Calculate deltas
  const hasPrevData = previousData && previousData.length > 0
  const capitalDelta = hasPrevData ? totalCapital - prevTotalCapital : 0
  const successDelta = hasPrevData ? averageSuccessRate - prevAverageSuccessRate : 0
  const milestoneDelta = hasPrevData ? totalMilestones - prevTotalMilestones : 0

  return {
    totalCapital,
    prevTotalCapital,
    averageSuccessRate: Math.round(averageSuccessRate * 100) / 100,
    prevAverageSuccessRate: Math.round(prevAverageSuccessRate * 100) / 100,
    totalMilestones,
    prevTotalMilestones,
    capitalDelta: Math.round(capitalDelta * 100) / 100,
    successDelta: Math.round(successDelta * 100) / 100,
    milestoneDelta,
    capitalTrend: capitalDelta >= 0,
    successTrend: successDelta >= 0,
    milestoneTrend: milestoneDelta >= 0,
  }
}

/**
 * Format a number as a percentage string with optional decimal places.
 *
 * @param value - Numeric percentage value
 * @param decimals - Number of decimal places to show (default: 0)
 * @returns Formatted string (e.g., "85%", "7.5%")
 */
export function formatPercentage(value: number, decimals: number = 0): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Format a number as currency (USDC) with comma separators.
 *
 * @param value - Numeric USDC value
 * @returns Formatted string (e.g., "$12,450", "$3,200")
 */
export function formatCurrency(value: number): string {
  return `$${formatUsdc(Math.round(value), { exact: true })}`
}
