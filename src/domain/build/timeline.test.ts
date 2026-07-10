import { describe, expect, it } from 'vitest'
import { DIGEST_THRESHOLD, groupTimeline } from '@/domain/build/timeline'
import type { Photo } from '@/domain/models'

/** Test factory building a Photo from the minimal fields. */
function photo(over: Partial<Photo> & { id: string; takenAt: string }): Photo {
  return {
    aspect: '4/3',
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
    ...over,
  }
}

/** `count` sequential photos on `date` (for digests). */
function burst(date: string, count: number): Photo[] {
  const out: Photo[] = []
  for (let i = 0; i < count; i++) {
    const hh = String(9 + Math.floor(i / 60)).padStart(2, '0')
    const mm = String(i % 60).padStart(2, '0')
    out.push(photo({ id: `${date}-${i}`, takenAt: `${date}T${hh}:${mm}:00` }))
  }
  return out
}

describe('groupTimeline', () => {
  it('a day with photos is kind:photos, sorted by ascending takenAt', () => {
    const photos = [
      photo({ id: 'b', takenAt: '2026-07-05T14:30:00' }),
      photo({ id: 'a', takenAt: '2026-07-05T09:00:00' }),
      photo({ id: 'c', takenAt: '2026-07-05T18:15:00' }),
    ]
    const [entry] = groupTimeline(photos, [], '2026-07-05')
    expect(entry.kind).toBe('photos')
    if (entry.kind !== 'photos') throw new Error('unreachable')
    expect(entry.photos.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(entry.note).toBeNull()
  })

  it('derives the common fields (date/place/today) — no baked presentation strings', () => {
    const photos = [
      photo({ id: 'a', takenAt: '2026-07-05T09:00:00', place: null }),
      photo({ id: 'b', takenAt: '2026-07-05T10:00:00', place: 'Kyoto' }),
    ]
    const [entry] = groupTimeline(photos, [], '2026-07-05')
    expect(entry.date).toBe('2026-07-05')
    expect(entry.place).toBe('Kyoto') // first non-null place
    expect(entry.today).toBe(true)
    expect('monthDay' in entry).toBe(false)
    expect('weekday' in entry).toBe(false)
  })

  it('place is the first non-null, or null when all are null', () => {
    const photos = [
      photo({ id: 'a', takenAt: '2026-07-05T09:00:00', place: null }),
      photo({ id: 'b', takenAt: '2026-07-05T10:00:00', place: null }),
    ]
    const [entry] = groupTimeline(photos, [], '2026-07-01')
    expect(entry.place).toBeNull()
    expect(entry.today).toBe(false)
  })

  it('a photo day with a note carries the note', () => {
    const photos = [photo({ id: 'a', takenAt: '2026-07-05T09:00:00' })]
    const [entry] = groupTimeline(photos, [{ date: '2026-07-05', note: 'good day' }], '2026-07-05')
    expect(entry.kind).toBe('photos')
    if (entry.kind !== 'photos') throw new Error('unreachable')
    expect(entry.note).toBe('good day')
  })

  it('no photos but a note → kind:note_only', () => {
    const [entry] = groupTimeline([], [{ date: '2026-07-03', note: 'it rained' }], '2026-07-05')
    expect(entry.kind).toBe('note_only')
    if (entry.kind !== 'note_only') throw new Error('unreachable')
    expect(entry.note).toBe('it rained')
    expect(entry.place).toBeNull()
    expect(entry.date).toBe('2026-07-03')
    expect(entry.today).toBe(false)
  })

  it('sorts all dates (photo days ∪ note days) descending', () => {
    const photos = [
      photo({ id: 'x', takenAt: '2026-07-02T09:00:00' }),
      photo({ id: 'y', takenAt: '2026-07-05T09:00:00' }),
    ]
    const notes = [{ date: '2026-07-04', note: 'note only' }]
    const entries = groupTimeline(photos, notes, '2026-07-05')
    expect(entries.map((e) => e.date)).toEqual(['2026-07-05', '2026-07-04', '2026-07-02'])
    expect(entries.map((e) => e.kind)).toEqual(['photos', 'note_only', 'photos'])
  })

  it('exactly DIGEST_THRESHOLD is photos, over it is digest', () => {
    const atThreshold = groupTimeline(burst('2026-07-05', DIGEST_THRESHOLD), [], '2026-07-05')
    expect(atThreshold[0].kind).toBe('photos')

    const over = groupTimeline(burst('2026-07-05', DIGEST_THRESHOLD + 1), [], '2026-07-05')
    expect(over[0].kind).toBe('digest')
  })

  it('digest carries photoCount, cover (first 4), and note', () => {
    const photos = burst('2026-07-05', 35)
    const [entry] = groupTimeline(
      photos,
      [{ date: '2026-07-05', note: 'took a lot' }],
      '2026-07-05',
    )
    expect(entry.kind).toBe('digest')
    if (entry.kind !== 'digest') throw new Error('unreachable')
    expect(entry.photoCount).toBe(35)
    expect(entry.cover.map((p) => p.id)).toEqual([
      '2026-07-05-0',
      '2026-07-05-1',
      '2026-07-05-2',
      '2026-07-05-3',
    ])
    expect(entry.note).toBe('took a lot')
  })

  it('digest clusters split on a capture gap over one hour (time=first HH:MM, label=place, count)', () => {
    // 33 photos: 09:00–09:29 (30, contiguous) → 12:00 gap > 1h → 12:00–12:02 (3)
    const morning: Photo[] = []
    for (let i = 0; i < 30; i++) {
      const mm = String(i).padStart(2, '0')
      morning.push(
        photo({ id: `am-${i}`, takenAt: `2026-07-05T09:${mm}:00`, place: i === 0 ? 'Nara' : null }),
      )
    }
    const afternoon: Photo[] = []
    for (let i = 0; i < 3; i++) {
      const mm = String(i).padStart(2, '0')
      afternoon.push(photo({ id: `pm-${i}`, takenAt: `2026-07-05T12:${mm}:00` }))
    }
    const [entry] = groupTimeline([...afternoon, ...morning], [], '2026-07-05')
    expect(entry.kind).toBe('digest')
    if (entry.kind !== 'digest') throw new Error('unreachable')
    expect(entry.clusters).toEqual([
      { time: '09:00', label: 'Nara', count: 30 },
      { time: '12:00', label: 'Nara', count: 3 },
    ])
  })

  it('an exactly-one-hour gap stays in the same cluster (split is strictly >)', () => {
    const list: Photo[] = [
      photo({ id: 'g0', takenAt: '2026-07-05T09:00:00' }),
      photo({ id: 'g1', takenAt: '2026-07-05T10:00:00' }), // exactly 60 min → same
    ]
    for (let i = 0; i < 29; i++) {
      const mm = String(1 + i).padStart(2, '0')
      list.push(photo({ id: `g-${i}`, takenAt: `2026-07-05T10:${mm}:00` }))
    }
    const [entry] = groupTimeline(list, [], '2026-07-05')
    if (entry.kind !== 'digest') throw new Error('unreachable')
    expect(entry.clusters).toHaveLength(1)
    expect(entry.clusters[0]).toEqual({ time: '09:00', label: '', count: 31 })
  })

  it('empty input yields an empty array', () => {
    expect(groupTimeline([], [], '2026-07-05')).toEqual([])
  })

  it('does not mutate the input (input order is preserved)', () => {
    const photos = [
      photo({ id: 'b', takenAt: '2026-07-05T14:00:00' }),
      photo({ id: 'a', takenAt: '2026-07-05T09:00:00' }),
    ]
    groupTimeline(photos, [], '2026-07-05')
    expect(photos.map((p) => p.id)).toEqual(['b', 'a'])
  })
})
