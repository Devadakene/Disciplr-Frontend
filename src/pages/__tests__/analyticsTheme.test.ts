// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  ANALYTICS_TOKEN_FALLBACKS,
  getAnalyticsChartTokens,
  buildAnalyticsSeriesColors,
} from '../analyticsTheme'

// jsdom's getComputedStyle doesn't read inline CSS variables, so we stub it.
function makeRoot(props: Record<string, string> = {}): HTMLElement {
  const el = document.createElement('div')
  vi.spyOn(window, 'getComputedStyle').mockImplementation((target) => {
    if (target === el) {
      return {
        getPropertyValue: (p: string) => props[p] ?? '',
      } as unknown as CSSStyleDeclaration
    }
    return window.getComputedStyle(target)
  })
  return el
}

// Maps every AnalyticsChartTokens key (except legendLabelRole which is not CSS-driven)
// to its corresponding CSS custom property name.
const CSS_PROPS: Partial<Record<keyof typeof ANALYTICS_TOKEN_FALLBACKS, string>> = {
  accent: '--accent',
  success: '--success',
  danger: '--danger',
  info: '--info',
  warning: '--warning',
  text: '--text',
  muted: '--muted',
  surface: '--surface',
  surfaceRaised: '--surface-raised',
  border: '--border',
  bg: '--bg',
  accentTransparent: '--accent-transparent',
  legendGap: '--legend-gap',
  legendSwatchSize: '--legend-swatch-size',
  // Chart categorical palette tokens
  chartCategorical1: '--color-chart-categorical-1',
  chartCategorical2: '--color-chart-categorical-2',
  chartCategorical3: '--color-chart-categorical-3',
  chartCategorical4: '--color-chart-categorical-4',
  chartCategorical5: '--color-chart-categorical-5',
  // Chart sequential palette tokens
  chartSequential1: '--color-chart-sequential-1',
  chartSequential2: '--color-chart-sequential-2',
  chartSequential3: '--color-chart-sequential-3',
  chartSequential4: '--color-chart-sequential-4',
  chartSequential5: '--color-chart-sequential-5',
  // Chart structural tokens
  chartAxis: '--color-chart-axis',
  chartGrid: '--color-chart-grid',
  chartTooltipBg: '--color-chart-tooltipBg',
  chartTooltipBorder: '--color-chart-tooltipBorder',
  chartTooltipText: '--color-chart-tooltipText',
  chartTooltipLabel: '--color-chart-tooltipLabel',
}

describe('getAnalyticsChartTokens', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves each CSS custom property when all are defined', () => {
    const values: Record<string, string> = {}
    for (const [key, prop] of Object.entries(CSS_PROPS)) {
      values[prop] = `#custom-${key}`
    }
    const root = makeRoot(values)
    const tokens = getAnalyticsChartTokens(root)

    for (const key of Object.keys(CSS_PROPS) as (keyof typeof CSS_PROPS)[]) {
      expect(tokens[key]).toBe(`#custom-${key}`)
    }
  })

  it('falls back to ANALYTICS_TOKEN_FALLBACKS when no properties are set', () => {
    const root = makeRoot({})
    const tokens = getAnalyticsChartTokens(root)
    expect(tokens).toEqual(ANALYTICS_TOKEN_FALLBACKS)
  })

  it('falls back per-key for partially-defined properties', () => {
    const root = makeRoot({ '--accent': '#aabbcc' })
    const tokens = getAnalyticsChartTokens(root)
    expect(tokens.accent).toBe('#aabbcc')
    expect(tokens.success).toBe(ANALYTICS_TOKEN_FALLBACKS.success)
    expect(tokens.danger).toBe(ANALYTICS_TOKEN_FALLBACKS.danger)
  })

  it('treats whitespace-only property values as missing (uses fallback)', () => {
    const root = makeRoot({ '--accent': '   ' })
    const tokens = getAnalyticsChartTokens(root)
    // trim() makes whitespace-only become '' which is falsy → fallback
    expect(tokens.accent).toBe(ANALYTICS_TOKEN_FALLBACKS.accent)
  })

  it('uses document.documentElement when called with no argument', () => {
    vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
      getPropertyValue: () => '#default-root',
    } as unknown as CSSStyleDeclaration))

    const tokens = getAnalyticsChartTokens()
    expect(tokens.accent).toBe('#default-root')
  })

  it('reads chart categorical tokens from --color-chart-categorical-* properties', () => {
    const root = makeRoot({
      '--color-chart-categorical-1': '#111111',
      '--color-chart-categorical-3': '#333333',
    })
    const tokens = getAnalyticsChartTokens(root)
    expect(tokens.chartCategorical1).toBe('#111111')
    expect(tokens.chartCategorical3).toBe('#333333')
    expect(tokens.chartCategorical2).toBe(ANALYTICS_TOKEN_FALLBACKS.chartCategorical2)
  })

  it('reads chart structural tokens from --color-chart-* properties', () => {
    const root = makeRoot({
      '--color-chart-axis': '#AAAAAA',
      '--color-chart-grid': '#BBBBBB',
      '--color-chart-tooltipBg': '#CCCCCC',
    })
    const tokens = getAnalyticsChartTokens(root)
    expect(tokens.chartAxis).toBe('#AAAAAA')
    expect(tokens.chartGrid).toBe('#BBBBBB')
    expect(tokens.chartTooltipBg).toBe('#CCCCCC')
  })
})

describe('buildAnalyticsSeriesColors', () => {
  const tokens = getAnalyticsChartTokens(makeRoot({})) // all fallbacks

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('maps series keys to chart categorical token values', () => {
    const series = buildAnalyticsSeriesColors(tokens)
    // Series colors now come from the categorical chart palette, not generic semantic tokens
    expect(series.success).toBe(tokens.chartCategorical1)
    expect(series.failed).toBe(tokens.chartCategorical5)
    expect(series.comparison).toBe(tokens.chartCategorical2)
    expect(series.milestone).toBe(tokens.chartCategorical3)
    expect(series.active).toBe(tokens.chartCategorical1)
    expect(series.warning).toBe(tokens.chartCategorical3)
  })

  it('maps structural series keys to chart structural token values', () => {
    const series = buildAnalyticsSeriesColors(tokens)
    expect(series.platform).toBe(tokens.chartAxis)
    expect(series.grid).toBe(tokens.chartGrid)
    expect(series.axis).toBe(tokens.chartAxis)
    expect(series.tooltipBackground).toBe(tokens.chartTooltipBg)
    expect(series.tooltipBorder).toBe(tokens.chartTooltipBorder)
    expect(series.tooltipText).toBe(tokens.chartTooltipText)
    expect(series.tooltipMuted).toBe(tokens.chartTooltipLabel)
  })

  it('produces pie as [cat1, cat2, cat5] from the categorical palette', () => {
    const series = buildAnalyticsSeriesColors(tokens)
    expect(series.pie).toEqual([tokens.chartCategorical1, tokens.chartCategorical2, tokens.chartCategorical5])
  })

  it('contains exactly the expected top-level keys', () => {
    const series = buildAnalyticsSeriesColors(tokens)
    expect(Object.keys(series)).toEqual([
      'success', 'failed', 'comparison', 'milestone', 'active',
      'warning', 'platform', 'grid', 'axis',
      'tooltipBackground', 'tooltipBorder', 'tooltipText', 'tooltipMuted', 'pie',
    ])
  })
})

describe('ANALYTICS_TOKEN_FALLBACKS', () => {
  it('has values for all token keys', () => {
    // 15 original + 16 chart-specific = 31 total keys
    expect(Object.keys(ANALYTICS_TOKEN_FALLBACKS)).toHaveLength(31)
  })

  it('every value is a non-empty string', () => {
    for (const val of Object.values(ANALYTICS_TOKEN_FALLBACKS)) {
      expect(typeof val).toBe('string')
      expect(val.trim().length).toBeGreaterThan(0)
    }
  })

  it('chart categorical fallbacks use light-mode hex values from colors.json', () => {
    expect(ANALYTICS_TOKEN_FALLBACKS.chartCategorical1).toBe('#1E40AF')
    expect(ANALYTICS_TOKEN_FALLBACKS.chartCategorical2).toBe('#0D9488')
    expect(ANALYTICS_TOKEN_FALLBACKS.chartCategorical3).toBe('#D97706')
    expect(ANALYTICS_TOKEN_FALLBACKS.chartCategorical4).toBe('#6D28D9')
    expect(ANALYTICS_TOKEN_FALLBACKS.chartCategorical5).toBe('#BE185D')
  })

  it('chart structural fallbacks use light-mode values from colors.json', () => {
    expect(ANALYTICS_TOKEN_FALLBACKS.chartAxis).toBe('#6B7280')
    expect(ANALYTICS_TOKEN_FALLBACKS.chartGrid).toBe('#E5E7EB')
    expect(ANALYTICS_TOKEN_FALLBACKS.chartTooltipBg).toBe('#FFFFFF')
    expect(ANALYTICS_TOKEN_FALLBACKS.chartTooltipText).toBe('#111827')
  })
})

describe('legend tokens', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('falls back to default legend gap/swatch sizing when unset', () => {
    const tokens = getAnalyticsChartTokens(makeRoot({}))
    expect(tokens.legendGap).toBe(ANALYTICS_TOKEN_FALLBACKS.legendGap)
    expect(tokens.legendSwatchSize).toBe(ANALYTICS_TOKEN_FALLBACKS.legendSwatchSize)
    // legendLabelRole is not CSS-driven and always uses the fallback role.
    expect(tokens.legendLabelRole).toBe(ANALYTICS_TOKEN_FALLBACKS.legendLabelRole)
  })

  it('resolves legend sizing from CSS variables when present', () => {
    const tokens = getAnalyticsChartTokens(
      makeRoot({ '--legend-gap': '1.25rem', '--legend-swatch-size': '0.5rem' }),
    )
    expect(tokens.legendGap).toBe('1.25rem')
    expect(tokens.legendSwatchSize).toBe('0.5rem')
  })
})

describe('custom root element handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('reads tokens from the provided root, not document.documentElement', () => {
    // documentElement returns one set of values…
    const customRoot = document.createElement('section')
    vi.spyOn(window, 'getComputedStyle').mockImplementation((target) => {
      if (target === customRoot) {
        return {
          getPropertyValue: (p: string) => (p === '--color-chart-categorical-1' ? '#fromcustom' : ''),
        } as unknown as CSSStyleDeclaration
      }
      // a non-custom root would resolve to a different value
      return {
        getPropertyValue: (p: string) => (p === '--color-chart-categorical-1' ? '#fromdocument' : ''),
      } as unknown as CSSStyleDeclaration
    })

    expect(getAnalyticsChartTokens(customRoot).chartCategorical1).toBe('#fromcustom')
    expect(getAnalyticsChartTokens().chartCategorical1).toBe('#fromdocument')
  })
})

describe('buildAnalyticsSeriesColors determinism for N series', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('produces identical output across repeated calls (stable for N series)', () => {
    const tokens = getAnalyticsChartTokens(makeRoot({}))
    const first = buildAnalyticsSeriesColors(tokens)
    const second = buildAnalyticsSeriesColors(tokens)
    expect(second).toEqual(first)
    // pie palette ordering is stable for the N=3 series case.
    expect(second.pie).toEqual(first.pie)
    expect(second.pie).toHaveLength(3)
  })

  it('reflects token changes deterministically without leaking previous values', () => {
    const a = buildAnalyticsSeriesColors(getAnalyticsChartTokens(makeRoot({ '--color-chart-categorical-1': '#001122' })))
    const b = buildAnalyticsSeriesColors(getAnalyticsChartTokens(makeRoot({ '--color-chart-categorical-1': '#334455' })))
    expect(a.success).toBe('#001122')
    expect(b.success).toBe('#334455')
    expect(a.pie[0]).toBe('#001122')
    expect(b.pie[0]).toBe('#334455')
  })
})
