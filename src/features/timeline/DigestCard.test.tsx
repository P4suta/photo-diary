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

  it('4 cover buttons + a non-interactive overflow tile', () => {
    renderWithProviders(<DigestCard day={digest} />)
    expect(screen.getAllByLabelText('Open photo')).toHaveLength(4)
    // The overflow indicator shows how many more photos exist (real data), but is not a
    // clickable action until the day-detail screen (2b) is built.
    expect(screen.queryByLabelText('Show all')).toBeNull()
    expect(screen.getByText('+4,314')).toBeInTheDocument()
  })

  it('lists clusters with time and label', () => {
    renderWithProviders(<DigestCard day={digest} />)
    expect(screen.getByText('Departure')).toBeInTheDocument()
    expect(screen.getByText('Kenroku-en')).toBeInTheDocument()
  })

  it('renders real cover thumbnails when photos carry a thumbUrl', () => {
    const withThumbs: Extract<DayEntry, { kind: 'digest' }> = {
      ...digest,
      cover: [
        { ...photo('c1'), thumbUrl: 'asset://c1.avif' },
        { ...photo('c2'), thumbUrl: 'asset://c2.avif' },
        { ...photo('c3'), thumbUrl: 'asset://c3.avif' },
        { ...photo('c4'), thumbUrl: 'asset://c4.avif' },
      ],
    }
    renderWithProviders(<DigestCard day={withThumbs} />)
    const tiles = screen.getAllByLabelText('Open photo')
    const imgs = tiles.map((t) => t.querySelector('img'))
    expect(imgs.filter(Boolean)).toHaveLength(4)
    expect(imgs[0]).toHaveAttribute('src', 'asset://c1.avif')
    expect(tiles[0].className).not.toContain('ph')
  })

  it('falls back to the .ph placeholder when cover photos have no thumbUrl', () => {
    renderWithProviders(<DigestCard day={digest} />)
    const tiles = screen.getAllByLabelText('Open photo')
    expect(tiles[0].querySelector('img')).toBeNull()
    expect(tiles[0].className).toContain('ph')
  })
})
