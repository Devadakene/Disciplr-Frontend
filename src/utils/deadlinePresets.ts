export type DeadlinePreset = '7d' | '30d' | '90d'

export function computeFutureDeadline(days: number, now: Date = new Date()): string {
  const future = new Date(now)
  future.setDate(future.getDate() + days)
  const year = future.getFullYear()
  const month = String(future.getMonth() + 1).padStart(2, '0')
  const day = String(future.getDate()).padStart(2, '0')
  const hours = String(future.getHours()).padStart(2, '0')
  const minutes = String(future.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export const DEADLINE_PRESETS: DeadlinePreset[] = ['7d', '30d', '90d']

export function getPresetDays(preset: DeadlinePreset): number {
  return parseInt(preset, 10)
}

export function getPresetLabel(preset: DeadlinePreset): string {
  return `${getPresetDays(preset)} days`
}