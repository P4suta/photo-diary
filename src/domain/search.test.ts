import { describe, expect, it } from 'vitest'
import {
  filterSearchParams,
  NO_LOCATION_SENTINEL,
  parseTimelineFilter,
  presetRange,
} from './search'

describe('timeline search', () => {
  const now = new Date(2026, 6, 25, 18, 30)

  it('builds inclusive local-date preset ranges', () => {
    expect(presetRange('today', now)).toEqual({
      startDate: '2026-07-25',
      endDate: '2026-07-25',
    })
    expect(presetRange('thisWeek', now)).toEqual({
      startDate: '2026-07-20',
      endDate: '2026-07-25',
    })
    expect(presetRange('thisMonth', now).startDate).toBe('2026-07-01')
    expect(presetRange('thisYear', now).startDate).toBe('2026-01-01')
    expect(presetRange('todayLastYear', now)).toEqual({
      startDate: '2025-07-25',
      endDate: '2025-07-25',
    })
  })

  it('round-trips repeated OR places and a stable no-location sentinel', () => {
    const params = filterSearchParams({
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      places: ['Tokyo, JP', null, 'Kyoto, JP'],
    })
    expect(params.getAll('place')).toEqual(['Tokyo, JP', NO_LOCATION_SENTINEL, 'Kyoto, JP'])
    expect(parseTimelineFilter(`?${params}`)).toEqual({
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      places: ['Tokyo, JP', null, 'Kyoto, JP'],
    })
  })

  it('treats an empty URL as no active filter', () => {
    expect(parseTimelineFilter('')).toBeUndefined()
    expect(filterSearchParams()).toEqual(new URLSearchParams())
    expect(filterSearchParams({ places: [] })).toEqual(new URLSearchParams())
  })

  it('supports each optional filter independently', () => {
    expect(parseTimelineFilter('?from=2026-07-01')).toEqual({
      startDate: '2026-07-01',
      endDate: undefined,
      places: [],
    })
    expect(parseTimelineFilter('?to=2026-07-31')).toEqual({
      startDate: undefined,
      endDate: '2026-07-31',
      places: [],
    })
    expect(parseTimelineFilter(`?place=${NO_LOCATION_SENTINEL}`)).toEqual({
      startDate: undefined,
      endDate: undefined,
      places: [null],
    })
  })
})
