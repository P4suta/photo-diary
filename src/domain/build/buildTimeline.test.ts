import { describe, expect, it } from 'vitest'
import { buildTimeline, EMPTY_GAP_LIMIT } from '@/domain/build/timeline'
import type { Photo } from '@/domain/models'

function photo(id: string, takenAt: string): Photo {
  return {
    id,
    aspect: '4/3',
    takenAt,
    place: null,
    starred: false,
    caption: null,
    width: 4000,
    height: 3000,
    megapixels: 12,
    sizeBytes: 1_000_000,
    format: 'AVIF',
    quality: 'high',
    originalFilename: 'IMG.jpg',
    importedAt: '2026-07-01T00:00:00',
    lat: null,
    lng: null,
  }
}

describe('buildTimeline — today guarantee', () => {
  it('with no photos and no notes, still emits an editable today card', () => {
    const out = buildTimeline([], [], '2026-07-11')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ date: '2026-07-11', kind: 'note_only', note: '', today: true })
  })

  it('keeps today at the front when today is the newest date', () => {
    const out = buildTimeline([photo('a', '2026-07-09T09:00:00')], [], '2026-07-11')
    expect(out[0]).toMatchObject({ date: '2026-07-11', kind: 'note_only' })
    expect(out.some((e) => e.date === '2026-07-09' && e.kind === 'photos')).toBe(true)
  })

  it('does not overwrite today when today already has photos', () => {
    const out = buildTimeline([photo('a', '2026-07-11T09:00:00')], [], '2026-07-11')
    const today = out.find((e) => e.date === '2026-07-11')
    expect(today?.kind).toBe('photos')
  })

  it('does not overwrite today when today already has a note', () => {
    const out = buildTimeline([], [{ date: '2026-07-11', note: 'hello' }], '2026-07-11')
    const today = out.find((e) => e.date === '2026-07-11')
    expect(today).toMatchObject({ kind: 'note_only', note: 'hello' })
  })
})

describe('buildTimeline — empty gap filling', () => {
  it('fills the days between two recorded days within the limit (descending)', () => {
    const out = buildTimeline(
      [photo('a', '2026-07-08T09:00:00'), photo('b', '2026-07-11T09:00:00')],
      [],
      '2026-07-11',
    )
    // 07-11 (photos), 07-10 (empty), 07-09 (empty), 07-08 (photos)
    expect(out.map((e) => e.date)).toEqual(['2026-07-11', '2026-07-10', '2026-07-09', '2026-07-08'])
    expect(out.map((e) => e.kind)).toEqual(['photos', 'empty', 'empty', 'photos'])
  })

  it('inserts no empty rows for consecutive days', () => {
    const out = buildTimeline(
      [photo('a', '2026-07-10T09:00:00'), photo('b', '2026-07-11T09:00:00')],
      [],
      '2026-07-11',
    )
    expect(out.some((e) => e.kind === 'empty')).toBe(false)
  })

  it('leaves gaps longer than EMPTY_GAP_LIMIT unfilled', () => {
    const start = '2026-06-01T09:00:00'
    const out = buildTimeline(
      [photo('a', start), photo('b', '2026-07-11T09:00:00')],
      [],
      '2026-07-11',
    )
    // The June→July gap is far larger than the limit → no empty rows.
    expect(out.some((e) => e.kind === 'empty')).toBe(false)
    expect(EMPTY_GAP_LIMIT).toBeGreaterThan(0)
  })
})
