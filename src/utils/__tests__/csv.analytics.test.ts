import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { toCsv } from '../csv'
import type { AnalyticsRow } from '../csv'

// Feature: analytics-csv-export, Property 1: stable header
describe('CSV analytics export', () => {
  it('produces stable header row for analytics data', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.string(),
            success: fc.integer({ min: 0, max: 100 }),
            failed: fc.integer({ min: 0, max: 100 }),
            capital: fc.integer({ min: 0, max: 100000 }),
            milestones: fc.integer({ min: 0, max: 100 }),
          }),
        ),
        (rows) => {
          const result = toCsv(rows, 'analytics')
          const header = result.split('\r\n')[0]
          expect(header).toBe('Period,Success %,Failed %,Capital (USDC),Milestones')
        },
      ),
      { numRuns: 100 },
    )
  })

  // Feature: analytics-csv-export, Property 2: row count matches input length
  it('row count matches input length for analytics', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.string(),
            success: fc.integer({ min: 0, max: 100 }),
            failed: fc.integer({ min: 0, max: 100 }),
            capital: fc.integer({ min: 0, max: 100000 }),
            milestones: fc.integer({ min: 0, max: 100 }),
          }),
          { minLength: 1, maxLength: 50 },
        ),
        (rows) => {
          const result = toCsv(rows, 'analytics')
          const lines = result.split('\r\n').filter(Boolean)
          expect(lines.length).toBe(rows.length + 1) // +1 for header
        },
      ),
      { numRuns: 100 },
    )
  })

  // Feature: analytics-csv-export, Property 3: cell values are escape-safe
  it('cell values are escape-safe for analytics', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.oneof(
            fc.constant('=cmd'),
            fc.constant('+1-1'),
            fc.constant('-1+1'),
            fc.constant('@SUM'),
            fc.constant('\tcmd'),
            fc.constant('\rcmd'),
            fc.constant('Test, Vault'),
            fc.constant('Test "Main" Vault'),
            fc.constant('Line one\nLine two'),
          ),
          success: fc.integer({ min: 0, max: 100 }),
          failed: fc.integer({ min: 0, max: 100 }),
          capital: fc.integer({ min: 0, max: 100000 }),
          milestones: fc.integer({ min: 0, max: 100 }),
        }),
        (row) => {
          const result = toCsv([row], 'analytics')
          // Should have header + one data row
          const [, dataRow] = result.split('\r\n')
          // Check that injection chars are escaped
          if (row.name.startsWith('=') || row.name.startsWith('+') || row.name.startsWith('-') || row.name.startsWith('@') || row.name.startsWith('\t')) {
            // Should have escaped with single quote prefix or quotes
            expect(dataRow).toMatch(/['"]/)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('toCsv analytics overload', () => {
  it('returns header-only for empty analytics array', () => {
    const result = toCsv([], 'analytics')
    expect(result).toBe('Period,Success %,Failed %,Capital (USDC),Milestones')
  })

  it('produces correct rows for non-empty analytics data', () => {
    const data: AnalyticsRow[] = [
      { name: 'Wk1', success: 65, failed: 35, capital: 800, milestones: 3 },
      { name: 'Wk2', success: 70, failed: 30, capital: 1200, milestones: 5 },
    ]
    const result = toCsv(data, 'analytics')
    const lines = result.split('\r\n')

    expect(lines[0]).toBe('Period,Success %,Failed %,Capital (USDC),Milestones')
    expect(lines[1]).toBe('Wk1,65,35,800,3')
    expect(lines[2]).toBe('Wk2,70,30,1200,5')
    expect(lines).toHaveLength(3)
  })

  it('escapes commas in period name', () => {
    const data: AnalyticsRow[] = [{ name: 'Week, 1', success: 100, failed: 0, capital: 500, milestones: 1 }]
    const result = toCsv(data, 'analytics')
    expect(result).toContain('"Week, 1"')
  })

  it('escapes double quotes in period name', () => {
    const data: AnalyticsRow[] = [{ name: 'Week "A" Vault', success: 100, failed: 0, capital: 500, milestones: 1 }]
    const result = toCsv(data, 'analytics')
    expect(result).toContain('"Week ""A"" Vault"')
  })

  it('escapes newlines in period name', () => {
    const data: AnalyticsRow[] = [{ name: 'Week\n1', success: 100, failed: 0, capital: 500, milestones: 1 }]
    const result = toCsv(data, 'analytics')
    expect(result).toContain('"Week\n1"')
  })
})