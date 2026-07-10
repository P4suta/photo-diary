import { describe, expect, it } from 'vitest'
import type { Photo } from '@/domain/models'
import { groupHighlights } from './highlights'

/** Minimal Photo factory for deterministic tests; only takenAt and id vary. */
function photo(id: string, takenAt: string): Photo {
  return {
    id,
    aspect: '4/3',
    takenAt,
    place: null,
    starred: true,
    caption: null,
    width: 4000,
    height: 3000,
    megapixels: 12,
    sizeBytes: 1_000_000,
    format: 'avif',
    quality: 'high',
    originalFilename: `${id}.jpg`,
    importedAt: '2026-07-05T00:00:00',
    lat: null,
    lng: null,
  }
}

describe('groupHighlights', () => {
  it('empty input: total=0, months=[], libraryTotal unchanged', () => {
    const result = groupHighlights([], 128)
    expect(result.total).toBe(0)
    expect(result.libraryTotal).toBe(128)
    expect(result.months).toEqual([])
  })

  it('single month: builds yearMonth/count/photos (no baked labels)', () => {
    const photos = [photo('a', '2026-07-01T09:00:00'), photo('b', '2026-07-20T18:30:00')]
    const result = groupHighlights(photos, 50)

    expect(result.total).toBe(2)
    expect(result.libraryTotal).toBe(50)
    expect(result.months).toEqual([{ yearMonth: '2026-07', count: 2, photos }])
  })

  it('multiple months: sorted by year-month key descending (newest first)', () => {
    const may = photo('may', '2026-05-15T12:00:00')
    const junA = photo('junA', '2026-06-02T08:00:00')
    const junB = photo('junB', '2026-06-28T20:00:00')
    const jul = photo('jul', '2026-07-04T10:00:00')

    const result = groupHighlights([junA, jul, may, junB], 200)

    expect(result.months.map((m) => m.yearMonth)).toEqual(['2026-07', '2026-06', '2026-05'])
    expect(result.months.map((m) => m.count)).toEqual([1, 2, 1])
    // Within June, input order (junA, junB) is preserved.
    expect(result.months[1].photos).toEqual([junA, junB])
    expect(result.total).toBe(4)
  })

  it('across years: sorted descending including the year (2026-01 before 2025-12)', () => {
    const dec2025 = photo('dec', '2025-12-31T23:00:00')
    const jan2026 = photo('jan', '2026-01-01T00:00:00')

    const result = groupHighlights([dec2025, jan2026], 10)

    expect(result.months.map((m) => m.yearMonth)).toEqual(['2026-01', '2025-12'])
    expect(result.months[0].photos).toEqual([jan2026])
    expect(result.months[1].photos).toEqual([dec2025])
  })

  it('does not mutate the input (original array/Photo untouched)', () => {
    const p = photo('a', '2026-07-01T09:00:00')
    const input = [p]
    const result = groupHighlights(input, 5)

    expect(input).toHaveLength(1)
    expect(result.months[0].photos).not.toBe(input)
    expect(result.months[0].photos[0]).toBe(p)
  })
})
