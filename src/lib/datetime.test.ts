import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  formatDateRange,
  formatDayLabel,
  formatImportedAt,
  formatMonthDay,
  formatMonthLabel,
  formatShortWeekday,
  formatTakenAt,
  formatWeekday,
  formatYearMonth,
  todayParts,
} from './datetime'

describe('todayParts', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the local year, 1-based month, and day of the current date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 5, 12, 0, 0)) // 2026-07-05 local
    expect(todayParts()).toEqual({ year: 2026, month: 7, day: 5 })
  })
})

describe('formatYearMonth', () => {
  it('formats a year and 1-based month label per locale', () => {
    expect(formatYearMonth(2026, 7, 'en')).toBe('July 2026')
    expect(formatYearMonth(2026, 7, 'ja')).toBe('2026年7月')
  })
})

describe('formatMonthDay', () => {
  it('formats per locale', () => {
    expect(formatMonthDay('2026-07-05', 'en')).toBe('July 5')
    expect(formatMonthDay('2026-07-05', 'ja')).toBe('7月5日')
  })

  it('reads only the date part of an ISO string', () => {
    expect(formatMonthDay('2026-07-05T23:00:00', 'en')).toBe('July 5')
  })
})

describe('formatWeekday / formatShortWeekday', () => {
  it('2026-07-05 is a Sunday', () => {
    expect(formatWeekday('2026-07-05', 'en')).toBe('Sunday')
    expect(formatWeekday('2026-07-05', 'ja')).toBe('日曜日')
    expect(formatShortWeekday('2026-07-05', 'en')).toBe('Sun')
    expect(formatShortWeekday('2026-07-05', 'ja')).toBe('日')
  })
})

describe('formatDayLabel', () => {
  it('combines a short month-day and short weekday', () => {
    // 2026-06-24 is a Wednesday.
    expect(formatDayLabel('2026-06-24', 'en')).toBe('Jun 24 Wed')
    expect(formatDayLabel('2026-06-24', 'ja')).toBe('6月24日 水')
  })
})

describe('formatDateRange', () => {
  it('includes both endpoints, per locale', () => {
    const en = formatDateRange('2026-06-24', '2026-06-27', 'en')
    expect(en).toMatch(/24/)
    expect(en).toMatch(/27/)
    expect(en).toMatch(/June/)
    const ja = formatDateRange('2026-06-24', '2026-06-27', 'ja')
    expect(ja).toMatch(/24/)
    expect(ja).toMatch(/27/)
  })
})

describe('formatMonthLabel', () => {
  it('formats a YYYY-MM month label per locale', () => {
    expect(formatMonthLabel('2026-07', 'en')).toBe('July')
    expect(formatMonthLabel('2026-07', 'ja')).toBe('7月')
  })
})

describe('formatTakenAt', () => {
  it('includes the year and 24h time, per locale', () => {
    const en = formatTakenAt('2026-07-04T16:42:00', 'en')
    expect(en).toMatch(/2026/)
    expect(en).toMatch(/16:42/)
    const ja = formatTakenAt('2026-07-04T16:42:00', 'ja')
    expect(ja).toMatch(/2026/)
    expect(ja).toMatch(/16:42/)
  })
})

describe('formatImportedAt', () => {
  it('includes the year and 24h time', () => {
    const en = formatImportedAt('2026-07-04T17:03:00', 'en')
    expect(en).toMatch(/2026/)
    expect(en).toMatch(/17:03/)
  })
})
