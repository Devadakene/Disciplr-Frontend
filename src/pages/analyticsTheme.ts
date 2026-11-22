import type { TypographyRole } from '../utils/typography'

export type AnalyticsChartTokens = {
  // General semantic tokens (unchanged)
  accent: string
  success: string
  danger: string
  info: string
  warning: string
  text: string
  muted: string
  surface: string
  surfaceRaised: string
  border: string
  bg: string
  accentTransparent: string
  legendGap: string
  legendSwatchSize: string
  legendLabelRole: TypographyRole
  // Chart-specific categorical palette tokens
  chartCategorical1: string
  chartCategorical2: string
  chartCategorical3: string
  chartCategorical4: string
  chartCategorical5: string
  // Chart-specific sequential palette tokens
  chartSequential1: string
  chartSequential2: string
  chartSequential3: string
  chartSequential4: string
  chartSequential5: string
  // Chart structural tokens
  chartAxis: string
  chartGrid: string
  chartTooltipBg: string
  chartTooltipBorder: string
  chartTooltipText: string
  chartTooltipLabel: string
}

export type AnalyticsSeriesColors = ReturnType<typeof buildAnalyticsSeriesColors>

export const ANALYTICS_TOKEN_FALLBACKS: AnalyticsChartTokens = {
  // General semantic fallbacks
  accent: '#0A7668',
  success: '#059669',
  danger: '#DC2626',
  info: '#2563EB',
  warning: '#D97706',
  text: '#111827',
  muted: '#4B5563',
  surface: '#F3F4F6',
  surfaceRaised: '#E5E7EB',
  border: '#E5E7EB',
  bg: '#F9FAFB',
  accentTransparent: 'rgba(10, 118, 104, 0.1)',
  legendGap: '0.75rem',
  legendSwatchSize: '0.625rem',
  legendLabelRole: 'caption',
  // Chart categorical fallbacks (light-mode values from colors.json)
  chartCategorical1: '#1E40AF',
  chartCategorical2: '#0D9488',
  chartCategorical3: '#D97706',
  chartCategorical4: '#6D28D9',
  chartCategorical5: '#BE185D',
  // Chart sequential fallbacks (light-mode values from colors.json)
  chartSequential1: '#E0F2FE',
  chartSequential2: '#7DD3FC',
  chartSequential3: '#0EA5E9',
  chartSequential4: '#0369A1',
  chartSequential5: '#0C4A6E',
  // Chart structural fallbacks (light-mode values from colors.json)
  chartAxis: '#6B7280',
  chartGrid: '#E5E7EB',
  chartTooltipBg: '#FFFFFF',
  chartTooltipBorder: '#E5E7EB',
  chartTooltipText: '#111827',
  chartTooltipLabel: '#6B7280',
}

function readToken(computed: CSSStyleDeclaration, token: string, fallback: string) {
  const value = computed.getPropertyValue(token).trim()
  return value || fallback
}

export function getAnalyticsChartTokens(root: HTMLElement = document.documentElement): AnalyticsChartTokens {
  const computed = getComputedStyle(root)

  return {
    // General semantic tokens
    accent: readToken(computed, '--accent', ANALYTICS_TOKEN_FALLBACKS.accent),
    success: readToken(computed, '--success', ANALYTICS_TOKEN_FALLBACKS.success),
    danger: readToken(computed, '--danger', ANALYTICS_TOKEN_FALLBACKS.danger),
    info: readToken(computed, '--info', ANALYTICS_TOKEN_FALLBACKS.info),
    warning: readToken(computed, '--warning', ANALYTICS_TOKEN_FALLBACKS.warning),
    text: readToken(computed, '--text', ANALYTICS_TOKEN_FALLBACKS.text),
    muted: readToken(computed, '--muted', ANALYTICS_TOKEN_FALLBACKS.muted),
    surface: readToken(computed, '--surface', ANALYTICS_TOKEN_FALLBACKS.surface),
    surfaceRaised: readToken(computed, '--surface-raised', ANALYTICS_TOKEN_FALLBACKS.surfaceRaised),
    border: readToken(computed, '--border', ANALYTICS_TOKEN_FALLBACKS.border),
    bg: readToken(computed, '--bg', ANALYTICS_TOKEN_FALLBACKS.bg),
    accentTransparent: readToken(computed, '--accent-transparent', ANALYTICS_TOKEN_FALLBACKS.accentTransparent),
    legendGap: readToken(computed, '--legend-gap', ANALYTICS_TOKEN_FALLBACKS.legendGap),
    legendSwatchSize: readToken(computed, '--legend-swatch-size', ANALYTICS_TOKEN_FALLBACKS.legendSwatchSize),
    legendLabelRole: ANALYTICS_TOKEN_FALLBACKS.legendLabelRole,
    // Chart categorical palette — read from --color-chart-categorical-* custom properties
    chartCategorical1: readToken(computed, '--color-chart-categorical-1', ANALYTICS_TOKEN_FALLBACKS.chartCategorical1),
    chartCategorical2: readToken(computed, '--color-chart-categorical-2', ANALYTICS_TOKEN_FALLBACKS.chartCategorical2),
    chartCategorical3: readToken(computed, '--color-chart-categorical-3', ANALYTICS_TOKEN_FALLBACKS.chartCategorical3),
    chartCategorical4: readToken(computed, '--color-chart-categorical-4', ANALYTICS_TOKEN_FALLBACKS.chartCategorical4),
    chartCategorical5: readToken(computed, '--color-chart-categorical-5', ANALYTICS_TOKEN_FALLBACKS.chartCategorical5),
    // Chart sequential palette — read from --color-chart-sequential-* custom properties
    chartSequential1: readToken(computed, '--color-chart-sequential-1', ANALYTICS_TOKEN_FALLBACKS.chartSequential1),
    chartSequential2: readToken(computed, '--color-chart-sequential-2', ANALYTICS_TOKEN_FALLBACKS.chartSequential2),
    chartSequential3: readToken(computed, '--color-chart-sequential-3', ANALYTICS_TOKEN_FALLBACKS.chartSequential3),
    chartSequential4: readToken(computed, '--color-chart-sequential-4', ANALYTICS_TOKEN_FALLBACKS.chartSequential4),
    chartSequential5: readToken(computed, '--color-chart-sequential-5', ANALYTICS_TOKEN_FALLBACKS.chartSequential5),
    // Chart structural tokens — read from --color-chart-* custom properties
    chartAxis: readToken(computed, '--color-chart-axis', ANALYTICS_TOKEN_FALLBACKS.chartAxis),
    chartGrid: readToken(computed, '--color-chart-grid', ANALYTICS_TOKEN_FALLBACKS.chartGrid),
    chartTooltipBg: readToken(computed, '--color-chart-tooltipBg', ANALYTICS_TOKEN_FALLBACKS.chartTooltipBg),
    chartTooltipBorder: readToken(computed, '--color-chart-tooltipBorder', ANALYTICS_TOKEN_FALLBACKS.chartTooltipBorder),
    chartTooltipText: readToken(computed, '--color-chart-tooltipText', ANALYTICS_TOKEN_FALLBACKS.chartTooltipText),
    chartTooltipLabel: readToken(computed, '--color-chart-tooltipLabel', ANALYTICS_TOKEN_FALLBACKS.chartTooltipLabel),
  }
}

export function buildAnalyticsSeriesColors(tokens: AnalyticsChartTokens) {
  return {
    // Series colors now use the categorical chart palette instead of general-purpose
    // semantic tokens, so the colorblind-safe, WCAG-validated palette is actually applied.
    success: tokens.chartCategorical1,
    failed: tokens.chartCategorical5,
    comparison: tokens.chartCategorical2,
    milestone: tokens.chartCategorical3,
    active: tokens.chartCategorical1,
    warning: tokens.chartCategorical3,
    platform: tokens.chartAxis,
    grid: tokens.chartGrid,
    axis: tokens.chartAxis,
    tooltipBackground: tokens.chartTooltipBg,
    tooltipBorder: tokens.chartTooltipBorder,
    tooltipText: tokens.chartTooltipText,
    tooltipMuted: tokens.chartTooltipLabel,
    pie: [tokens.chartCategorical1, tokens.chartCategorical2, tokens.chartCategorical5] as string[],
  }
}
