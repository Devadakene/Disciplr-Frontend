import { describe, expect, it } from 'vitest'
import {
  computeAnalyticsKpis,
  formatCurrency,
  formatPercentage,
  type AnalyticsDataPoint,
} from '../analyticsKpis'

const currentFixture: AnalyticsDataPoint[] = [
  { name: 'W1', success: 80, failed: 20, capital: 1000, milestones: 2 },
  { name: 'W2', success: 60, failed: 40, capital: 500, milestones: 3 },
]

const previousFixture: AnalyticsDataPoint[] = [
  { name: 'P1', success: 70, failed: 30, capital: 600, milestones: 4 },
  { name: 'P2', success: 50, failed: 50, capital: 400, milestones: 3 },
]

describe('computeAnalyticsKpis', () => {
  it('returns the zeroed structure for empty current data', () => {
    expect(computeAnalyticsKpis([])).toEqual({
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
    })
  })

  it('returns the zeroed structure even when previous data is provided if current data is empty', () => {
    expect(computeAnalyticsKpis([], previousFixture)).toEqual({
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
    })
  })

  it('computes totals and mean success rate for a single-point series with no previous data', () => {
    const single: AnalyticsDataPoint[] = [
      { name: 'W1', success: 85, failed: 15, capital: 2500, milestones: 4 },
    ]
    const result = computeAnalyticsKpis(single)

    expect(result).toEqual({
      totalCapital: 2500,
      prevTotalCapital: 0,
      averageSuccessRate: 85,
      prevAverageSuccessRate: 0,
      totalMilestones: 4,
      prevTotalMilestones: 0,
      capitalDelta: 0,
      successDelta: 0,
      milestoneDelta: 0,
      capitalTrend: true,
      successTrend: true,
      milestoneTrend: true,
    })
  })

  it('computes totals and mean of success across points for a known series without previous data', () => {
    const result = computeAnalyticsKpis(currentFixture)

    expect(result.averageSuccessRate).toBe(70)
    expect(result.totalCapital).toBe(1500)
    expect(result.totalMilestones).toBe(5)
    expect(result.prevTotalCapital).toBe(0)
    expect(result.prevAverageSuccessRate).toBe(0)
    expect(result.prevTotalMilestones).toBe(0)
    expect(result.capitalDelta).toBe(0)
    expect(result.successDelta).toBe(0)
    expect(result.milestoneDelta).toBe(0)
    expect(result.capitalTrend).toBe(true)
    expect(result.successTrend).toBe(true)
    expect(result.milestoneTrend).toBe(true)
  })

  it('treats an empty previous array the same as undefined previous data (deltas 0, trends true)', () => {
    const withUndefined = computeAnalyticsKpis(currentFixture, undefined)
    const withEmptyArray = computeAnalyticsKpis(currentFixture, [])

    expect(withEmptyArray).toEqual(withUndefined)
    expect(withEmptyArray.capitalDelta).toBe(0)
    expect(withEmptyArray.successDelta).toBe(0)
    expect(withEmptyArray.milestoneDelta).toBe(0)
    expect(withEmptyArray.capitalTrend).toBe(true)
    expect(withEmptyArray.successTrend).toBe(true)
    expect(withEmptyArray.milestoneTrend).toBe(true)
  })

  it('computes deltas as current minus previous and sets trend booleans for positive and negative changes', () => {
    // current: totalCapital = 1500, averageSuccessRate = 70, totalMilestones = 5
    // previous: totalCapital = 1000, averageSuccessRate = 60, totalMilestones = 7
    const result = computeAnalyticsKpis(currentFixture, previousFixture)

    expect(result.totalCapital).toBe(1500)
    expect(result.prevTotalCapital).toBe(1000)
    expect(result.capitalDelta).toBe(500)
    expect(result.capitalTrend).toBe(true)

    expect(result.averageSuccessRate).toBe(70)
    expect(result.prevAverageSuccessRate).toBe(60)
    expect(result.successDelta).toBe(10)
    expect(result.successTrend).toBe(true)

    expect(result.totalMilestones).toBe(5)
    expect(result.prevTotalMilestones).toBe(7)
    expect(result.milestoneDelta).toBe(-2)
    expect(result.milestoneTrend).toBe(false)
  })

  it('sets trend booleans for up, down, and zero change across two periods', () => {
    // Up change on capital, zero change on success, down change on milestones
    const prev: AnalyticsDataPoint[] = [
      { name: 'P1', success: 70, failed: 30, capital: 1000, milestones: 8 },
    ]
    const upZeroDown = computeAnalyticsKpis(currentFixture, prev)
    expect(upZeroDown.capitalDelta).toBe(500)
    expect(upZeroDown.capitalTrend).toBe(true)
    expect(upZeroDown.successDelta).toBe(0)
    expect(upZeroDown.successTrend).toBe(true)
    expect(upZeroDown.milestoneDelta).toBe(-3)
    expect(upZeroDown.milestoneTrend).toBe(false)

    // Down change on capital and success, zero change on milestones
    const prevHigher: AnalyticsDataPoint[] = [
      { name: 'P1', success: 90, failed: 10, capital: 2000, milestones: 5 },
    ]
    const downDownZero = computeAnalyticsKpis(currentFixture, prevHigher)
    expect(downDownZero.capitalDelta).toBe(-500)
    expect(downDownZero.capitalTrend).toBe(false)
    expect(downDownZero.successDelta).toBe(-20)
    expect(downDownZero.successTrend).toBe(false)
    expect(downDownZero.milestoneDelta).toBe(0)
    expect(downDownZero.milestoneTrend).toBe(true)
  })

  it('rounds average success rates and deltas to two decimal places', () => {
    const current: AnalyticsDataPoint[] = [
      { name: 'W1', success: 80, failed: 20, capital: 100, milestones: 1 },
      { name: 'W2', success: 70, failed: 30, capital: 100, milestones: 1 },
      { name: 'W3', success: 70, failed: 30, capital: 100, milestones: 1 },
    ]
    const prev: AnalyticsDataPoint[] = [
      { name: 'P1', success: 50, failed: 50, capital: 100, milestones: 1 },
      { name: 'P2', success: 50, failed: 50, capital: 100, milestones: 1 },
      { name: 'P3', success: 60, failed: 40, capital: 100, milestones: 1 },
    ]

    const result = computeAnalyticsKpis(current, prev)
    expect(result.averageSuccessRate).toBe(73.33)
    expect(result.prevAverageSuccessRate).toBe(53.33)
    expect(result.successDelta).toBe(20)
  })
})

describe('formatPercentage', () => {
  it('formats percentage with default 0 decimals and specified decimal places', () => {
    expect(formatPercentage(7.5, 1)).toBe('7.5%')
    expect(formatPercentage(85)).toBe('85%')
    expect(formatPercentage(0)).toBe('0%')
    expect(formatPercentage(73.333, 2)).toBe('73.33%')
  })
})

describe('formatCurrency', () => {
  it('rounds to nearest integer and formats with dollar sign and comma separators', () => {
    expect(formatCurrency(12449.6)).toBe('$12,450')
    expect(formatCurrency(12449.4)).toBe('$12,449')
    expect(formatCurrency(3200)).toBe('$3,200')
    expect(formatCurrency(0)).toBe('$0')
  })
})
