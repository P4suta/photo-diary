import { act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import { useUi } from '@/app/ui-store'
import type { Photo } from '@/domain/models'
import { renderWithProviders } from '@/test/utils'
import { Lightbox } from './Lightbox'

function photo(id: string): Photo {
  return {
    id,
    aspect: '4/3',
    takenAt: '2026-07-05T09:00:00',
    place: 'Shibuya, Tokyo',
    starred: false,
    caption: null,
    width: 4000,
    height: 3000,
    megapixels: 12,
    sizeBytes: 1_929_379,
    format: 'AVIF',
    quality: 'Visually lossless',
    originalFilename: 'IMG.jpg',
    importedAt: '2026-07-04T17:03:00',
    lat: 35.6595,
    lng: 139.7005,
  }
}

describe('Lightbox a11y', () => {
  it('has no axe violations when open', async () => {
    const { container } = renderWithProviders(<Lightbox />)
    act(() => useUi.getState().openLightbox([photo('a')], 0, 'July 5'))
    const opts = { rules: { region: { enabled: false }, 'color-contrast': { enabled: false } } }
    expect(await axe(container, opts)).toHaveNoViolations()
  })

  // Known gaps (to drive future fixes); these do not fail the gate.
  it.todo('give the modal role="dialog" / aria-modal')
  it.todo('implement a focus trap (Tab stays within the viewer)')
  it.todo('use aria-label instead of title on the nav buttons')
})
