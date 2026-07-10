import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import type { DayEntry, Photo } from '@/domain/models'
import { renderWithProviders } from '@/test/utils'
import { DayCard } from './DayCard'

function photo(id: string): Photo {
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
  }
}

const common = { place: null, today: false } as const
// region assumes a full-page landmark (false positive on a fragment); color-contrast
// cannot be measured in jsdom (no canvas). Disable both.
const opts = { rules: { region: { enabled: false }, 'color-contrast': { enabled: false } } }

const photosDay: DayEntry = {
  kind: 'photos',
  date: '2026-07-05',
  ...common,
  note: null,
  photos: [photo('a'), photo('b')],
}

const digestDay: DayEntry = {
  kind: 'digest',
  date: '2026-06-28',
  ...common,
  photoCount: 4318,
  cover: [photo('c1'), photo('c2'), photo('c3'), photo('c4')],
  clusters: [{ time: '07:40', label: 'Departure', count: 12 }],
  note: null,
}

describe('DayCard a11y', () => {
  it('photos card has no axe violations', async () => {
    const { container } = renderWithProviders(<DayCard day={photosDay} />)
    expect(await axe(container, opts)).toHaveNoViolations()
  })

  it('digest card (aria-labelled cover buttons) has no axe violations', async () => {
    const { container } = renderWithProviders(<DayCard day={digestDay} />)
    expect(await axe(container, opts)).toHaveNoViolations()
  })
})
