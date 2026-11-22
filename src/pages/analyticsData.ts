import type { AnalyticsDataPoint } from '../utils/analyticsKpis'

export type Period = '7d' | '30d' | '90d' | '1y' | 'All'

export const analyticsPeriodData: Record<Period, { name: string; success: number; failed: number; capital: number; milestones: number }[]> = {
  '7d': [
    { name: 'Mon', success: 80, failed: 20, capital: 2800, milestones: 2 },
    { name: 'Tue', success: 85, failed: 15, capital: 2900, milestones: 3 },
    { name: 'Wed', success: 78, failed: 22, capital: 2750, milestones: 2 },
    { name: 'Thu', success: 90, failed: 10, capital: 3100, milestones: 4 },
    { name: 'Fri', success: 88, failed: 12, capital: 3050, milestones: 3 },
    { name: 'Sat', success: 92, failed: 8,  capital: 3200, milestones: 5 },
    { name: 'Sun', success: 87, failed: 13, capital: 3150, milestones: 3 },
  ],
  '30d': [
    { name: 'Wk1', success: 65, failed: 35, capital: 800,  milestones: 3 },
    { name: 'Wk2', success: 70, failed: 30, capital: 1200, milestones: 5 },
    { name: 'Wk3', success: 80, failed: 20, capital: 2100, milestones: 6 },
    { name: 'Wk4', success: 88, failed: 12, capital: 3200, milestones: 9 },
  ],
  '90d': [
    { name: 'Jan', success: 65, failed: 35, capital: 800,  milestones: 3 },
    { name: 'Feb', success: 70, failed: 30, capital: 1200, milestones: 5 },
    { name: 'Mar', success: 68, failed: 32, capital: 950,  milestones: 4 },
  ],
  '1y': [
    { name: 'Jan', success: 65, failed: 35, capital: 800,  milestones: 3 },
    { name: 'Feb', success: 70, failed: 30, capital: 1200, milestones: 5 },
    { name: 'Mar', success: 68, failed: 32, capital: 950,  milestones: 4 },
    { name: 'Apr', success: 85, failed: 15, capital: 1800, milestones: 7 },
    { name: 'May', success: 88, failed: 12, capital: 2400, milestones: 6 },
    { name: 'Jun', success: 92, failed: 8,  capital: 3200, milestones: 9 },
    { name: 'Jul', success: 89, failed: 11, capital: 3000, milestones: 8 },
    { name: 'Aug', success: 91, failed: 9,  capital: 3400, milestones: 10 },
    { name: 'Sep', success: 86, failed: 14, capital: 2900, milestones: 7 },
    { name: 'Oct', success: 93, failed: 7,  capital: 3800, milestones: 11 },
    { name: 'Nov', success: 90, failed: 10, capital: 3500, milestones: 9 },
    { name: 'Dec', success: 95, failed: 5,  capital: 4200, milestones: 13 },
  ],
  'All': [
    { name: '2023', success: 60, failed: 40, capital: 500,  milestones: 2 },
    { name: '2024', success: 75, failed: 25, capital: 2100, milestones: 6 },
    { name: '2025', success: 88, failed: 12, capital: 4200, milestones: 9 },
  ],
}

// Previous period data for comparison
export const prevPeriodData: Record<Period, AnalyticsDataPoint[]> = {
  '7d': [
    { name: 'Mon', success: 60, failed: 40, capital: 2000, milestones: 1 },
    { name: 'Tue', success: 65, failed: 35, capital: 2100, milestones: 2 },
    { name: 'Wed', success: 70, failed: 30, capital: 2200, milestones: 2 },
    { name: 'Thu', success: 72, failed: 28, capital: 2300, milestones: 2 },
    { name: 'Fri', success: 68, failed: 32, capital: 2150, milestones: 1 },
    { name: 'Sat', success: 75, failed: 25, capital: 2400, milestones: 3 },
    { name: 'Sun', success: 71, failed: 29, capital: 2350, milestones: 2 },
  ],
  '30d': [
    { name: 'Wk1', success: 50, failed: 50, capital: 500, milestones: 1 },
    { name: 'Wk2', success: 58, failed: 42, capital: 750, milestones: 2 },
    { name: 'Wk3', success: 62, failed: 38, capital: 1100, milestones: 3 },
    { name: 'Wk4', success: 70, failed: 30, capital: 1800, milestones: 5 },
  ],
  '90d': [
    { name: 'Oct', success: 55, failed: 45, capital: 600, milestones: 2 },
    { name: 'Nov', success: 60, failed: 40, capital: 800, milestones: 2 },
    { name: 'Dec', success: 63, failed: 37, capital: 700, milestones: 2 },
  ],
  '1y': [
    { name: 'Jan', success: 45, failed: 55, capital: 400, milestones: 1 },
    { name: 'Feb', success: 50, failed: 50, capital: 600, milestones: 1 },
    { name: 'Mar', success: 48, failed: 52, capital: 500, milestones: 1 },
    { name: 'Apr', success: 65, failed: 35, capital: 900, milestones: 3 },
    { name: 'May', success: 68, failed: 32, capital: 1200, milestones: 3 },
    { name: 'Jun', success: 72, failed: 28, capital: 1800, milestones: 5 },
    { name: 'Jul', success: 70, failed: 30, capital: 1600, milestones: 4 },
    { name: 'Aug', success: 74, failed: 26, capital: 2000, milestones: 6 },
    { name: 'Sep', success: 69, failed: 31, capital: 1700, milestones: 4 },
    { name: 'Oct', success: 78, failed: 22, capital: 2200, milestones: 7 },
    { name: 'Nov', success: 75, failed: 25, capital: 2000, milestones: 6 },
    { name: 'Dec', success: 80, failed: 20, capital: 2500, milestones: 8 },
  ],
  'All': [
    { name: '2021', success: 40, failed: 60, capital: 200, milestones: 1 },
    { name: '2022', success: 52, failed: 48, capital: 800, milestones: 2 },
    { name: '2023', success: 60, failed: 40, capital: 1200, milestones: 3 },
  ],
}

export const vaultStatusData = [
  { name: 'Completed', value: 14 },
  { name: 'Active', value: 3 },
  { name: 'Failed', value: 4 },
]

export const milestoneTypes = [
  { type: 'Daily Exercise', count: 12 },
  { type: 'Study Goal', count: 9 },
  { type: 'No Spending', count: 7 },
  { type: 'Reading', count: 5 },
  { type: 'Sleep Schedule', count: 3 },
]

// Benchmarking data
export function computeBenchmarkData(kpis: { averageSuccessRate: number; totalMilestones: number; streak?: number; avgDuration?: number }) {
  return [
    { metric: 'Success Rate', you: Math.round(kpis.averageSuccessRate), platform: 68, unit: '%' },
    { metric: 'Avg Duration', you: kpis.avgDuration ?? 0, platform: 14, unit: 'd' },
    { metric: 'Streak', you: kpis.streak ?? 0, platform: 3, unit: '' },
    { metric: 'Milestones/mo', you: kpis.totalMilestones, platform: 5, unit: '' },
  ]
}

export const TEAM_CHART_DATA = [
  { name: 'Alice', rate: 94 },
  { name: 'Bob', rate: 78 },
  { name: 'Carol', rate: 88 },
  { name: 'Dave', rate: 65 },
]