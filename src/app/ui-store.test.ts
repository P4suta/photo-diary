import { beforeEach, describe, expect, it } from 'vitest'
import type { Photo } from '@/domain/models'
import { useUi } from './ui-store'

/** Minimal Photo factory (only id/index matter for the lightbox). */
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

const three = [photo('a'), photo('b'), photo('c')]

// node project (no setup.ts) → reset to initial state manually before each test.
const initial = useUi.getInitialState()
beforeEach(() => useUi.setState(initial, true))

describe('useUi lightbox', () => {
  it('openLightbox sets photos/index/context', () => {
    useUi.getState().openLightbox(three, 1, 'July 5')
    expect(useUi.getState().lightbox).toEqual({ photos: three, index: 1, context: 'July 5' })
  })

  it('closeLightbox resets to null', () => {
    useUi.getState().openLightbox(three, 0, '')
    useUi.getState().closeLightbox()
    expect(useUi.getState().lightbox).toBeNull()
  })

  it('lightboxNext advances and clamps at the last index (no wrap)', () => {
    useUi.getState().openLightbox(three, 0, '')
    useUi.getState().lightboxNext()
    expect(useUi.getState().lightbox?.index).toBe(1)
    useUi.getState().lightboxNext() // → 2 (last)
    useUi.getState().lightboxNext() // clamp, stays 2
    expect(useUi.getState().lightbox?.index).toBe(2)
  })

  it('lightboxPrev goes back and clamps at 0 (no wrap)', () => {
    useUi.getState().openLightbox(three, 1, '')
    useUi.getState().lightboxPrev()
    expect(useUi.getState().lightbox?.index).toBe(0)
    useUi.getState().lightboxPrev() // clamp, stays 0
    expect(useUi.getState().lightbox?.index).toBe(0)
  })

  it('next/prev are no-ops when the lightbox is null', () => {
    useUi.getState().lightboxNext()
    useUi.getState().lightboxPrev()
    expect(useUi.getState().lightbox).toBeNull()
  })
})

describe('useUi import state', () => {
  it('setImportState switches the state', () => {
    expect(useUi.getState().importState).toBe('closed')
    useUi.getState().setImportState('panel')
    expect(useUi.getState().importState).toBe('panel')
  })
})
