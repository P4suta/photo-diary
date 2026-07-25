import type { TimelineFilter } from './models'

export const NO_LOCATION_SENTINEL = '__no_location__'

export type DatePreset = 'today' | 'thisWeek' | 'thisMonth' | 'thisYear' | 'todayLastYear'

function iso(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function presetRange(
  preset: DatePreset,
  now = new Date(),
): {
  startDate: string
  endDate: string
} {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let start = new Date(end)
  switch (preset) {
    case 'today':
      break
    case 'thisWeek': {
      const mondayOffset = (end.getDay() + 6) % 7
      start.setDate(end.getDate() - mondayOffset)
      break
    }
    case 'thisMonth':
      start = new Date(end.getFullYear(), end.getMonth(), 1)
      break
    case 'thisYear':
      start = new Date(end.getFullYear(), 0, 1)
      break
    case 'todayLastYear':
      start = new Date(end.getFullYear() - 1, end.getMonth(), end.getDate())
      return { startDate: iso(start), endDate: iso(start) }
  }
  return { startDate: iso(start), endDate: iso(end) }
}

export function parseTimelineFilter(search: string): TimelineFilter | undefined {
  const params = new URLSearchParams(search)
  const startDate = params.get('from') || undefined
  const endDate = params.get('to') || undefined
  const places = params
    .getAll('place')
    .map((place) => (place === NO_LOCATION_SENTINEL ? null : place))
  if (!startDate && !endDate && places.length === 0) return undefined
  return { startDate, endDate, places }
}

export function filterSearchParams(filter?: TimelineFilter): URLSearchParams {
  const params = new URLSearchParams()
  if (filter?.startDate) params.set('from', filter.startDate)
  if (filter?.endDate) params.set('to', filter.endDate)
  for (const place of filter?.places ?? []) {
    params.append('place', place ?? NO_LOCATION_SENTINEL)
  }
  return params
}
