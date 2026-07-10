import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { DayEntry, Photo } from '@/domain/models'
import { renderWithProviders } from '@/test/utils'
import { DigestCard } from './DigestCard'

function photo(id: string): Photo {
  return {
    id,
    aspect: '4/3',
    takenAt: '2026-06-28T09:00:00',
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

const digest: Extract<DayEntry, { kind: 'digest' }> = {
  kind: 'digest',
  date: '2026-06-28',
  place: 'Kanazawa',
  today: false,
  photoCount: 4318,
  cover: [photo('c1'), photo('c2'), photo('c3'), photo('c4')],
  clusters: [
    { time: '07:40', label: 'Departure', count: 12 },
    { time: '10:15', label: 'Kenroku-en', count: 1428 },
  ],
  note: null,
}

describe('DigestCard', () => {
  it('cover grid has a count-independent fixed height h-[300px]', () => {
    renderWithProviders(<DigestCard day={digest} />)
    const cover = screen.getAllByLabelText('Open photo')[0]
    expect(cover.parentElement?.className).toContain('h-[300px]')
  })

  it('overflow badge shows photoCount - cover.length as +N', () => {
    renderWithProviders(<DigestCard day={digest} />)
    // 4318 - 4 = 4314
    expect(screen.getByText('+4,314')).toBeInTheDocument()
  })

  it('4 cover buttons + a "Show all" button', () => {
    renderWithProviders(<DigestCard day={digest} />)
    expect(screen.getAllByLabelText('Open photo')).toHaveLength(4)
    expect(screen.getByLabelText('Show all')).toBeInTheDocument()
  })

  it('lists clusters with time and label', () => {
    renderWithProviders(<DigestCard day={digest} />)
    expect(screen.getByText('Departure')).toBeInTheDocument()
    expect(screen.getByText('Kenroku-en')).toBeInTheDocument()
  })
})
