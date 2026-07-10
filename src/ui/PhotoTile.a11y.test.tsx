import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import type { Photo } from '@/domain/models'
import { renderWithProviders } from '@/test/utils'
import { PhotoTile } from './PhotoTile'

function photo(over: Partial<Photo> = {}): Photo {
  return {
    id: 'p1',
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

// region assumes a full-page landmark (false positive on a fragment); color-contrast
// cannot be measured in jsdom (no canvas). Disable both.
const opts = { rules: { region: { enabled: false }, 'color-contrast': { enabled: false } } }

describe('PhotoTile a11y', () => {
  it('has no axe violations even when starred and captioned', async () => {
    const { container } = renderWithProviders(
      <PhotoTile photo={photo({ starred: true, caption: 'Below the lighthouse.' })} />,
    )
    expect(await axe(container, opts)).toHaveNoViolations()
  })
})
