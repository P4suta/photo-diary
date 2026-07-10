import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { DayEntry, Photo } from '@/domain/models'
import { renderWithProviders } from '@/test/utils'
import { DayCard } from './DayCard'

function photo(id: string, over: Partial<Photo> = {}): Photo {
  return {
    id,
    aspect: '4/3',
    takenAt: '2026-07-05T09:00:00',
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

const common = { place: null, today: false } as const

const days: Record<DayEntry['kind'], DayEntry> = {
  empty: { kind: 'empty', date: '2026-07-03', ...common },
  note_only: { kind: 'note_only', date: '2026-07-01', ...common, note: 'it rained' },
  photos: {
    kind: 'photos',
    date: '2026-07-05',
    ...common,
    note: null,
    photos: [photo('a'), photo('b')],
  },
  digest: {
    kind: 'digest',
    date: '2026-06-28',
    ...common,
    photoCount: 4318,
    cover: [photo('c1'), photo('c2'), photo('c3'), photo('c4')],
    clusters: [{ time: '07:40', label: 'Departure', count: 12 }],
    note: null,
  },
  event: {
    kind: 'event',
    date: '2026-06-27',
    ...common,
    title: 'Kanazawa & Noto',
    start: '2026-06-24',
    end: '2026-06-27',
    photoCount: 16204,
    days: [{ date: '2026-06-24', thumbs: 4, photoCount: 842, hasNote: true }],
    note: null,
  },
}

describe('DayCard exhaustive switch', () => {
  it('empty: renders the "no record" divider row', () => {
    renderWithProviders(<DayCard day={days.empty} />)
    expect(screen.getByText(/No record/)).toBeInTheDocument()
  })

  it('note_only: renders "No photos" and the note body', () => {
    renderWithProviders(<DayCard day={days.note_only} />)
    expect(screen.getByText('No photos')).toBeInTheDocument()
    expect(screen.getByText('it rained')).toBeInTheDocument()
  })

  it('photos: renders the count and photo tiles', () => {
    renderWithProviders(<DayCard day={days.photos} />)
    expect(screen.getByText('2 photos')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Open photo').length).toBeGreaterThanOrEqual(2)
  })

  it('digest: renders the moss count, "Show all", and clusters', () => {
    renderWithProviders(<DayCard day={days.digest} />)
    expect(screen.getByText('4,318 photos')).toBeInTheDocument()
    expect(screen.getByLabelText('Show all')).toBeInTheDocument()
    expect(screen.getByText('Departure')).toBeInTheDocument()
  })

  it('event: renders the title and day rows', () => {
    renderWithProviders(<DayCard day={days.event} />)
    expect(screen.getByText('Kanazawa & Noto')).toBeInTheDocument()
    expect(screen.getByText(/Jun 24/)).toBeInTheDocument()
  })

  it('an unknown kind makes assertNever throw', () => {
    const bogus = { ...common, date: '2026-07-05', kind: 'bogus' } as unknown as DayEntry
    // React logs the render error to console.error; silence it.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderWithProviders(<DayCard day={bogus} />)).toThrow(/Unhandled DayEntry/)
    spy.mockRestore()
  })
})
