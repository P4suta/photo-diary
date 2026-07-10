import { beforeEach, describe, expect, it } from 'vitest'
import { useUi } from './ui-store'

const three = ['a', 'b', 'c']

// node project (no setup.ts) → reset to initial state manually before each test.
const initial = useUi.getInitialState()
beforeEach(() => useUi.setState(initial, true))

describe('useUi lightbox', () => {
  it('openLightbox sets ids/index/context/source', () => {
    useUi.getState().openLightbox(three, 1, 'July 5', 'timeline')
    expect(useUi.getState().lightbox).toEqual({
      ids: three,
      index: 1,
      context: 'July 5',
      source: 'timeline',
    })
  })

  it('closeLightbox resets to null', () => {
    useUi.getState().openLightbox(three, 0, '', 'timeline')
    useUi.getState().closeLightbox()
    expect(useUi.getState().lightbox).toBeNull()
  })

  it('lightboxNext advances and clamps at the last index (no wrap)', () => {
    useUi.getState().openLightbox(three, 0, '', 'timeline')
    useUi.getState().lightboxNext()
    expect(useUi.getState().lightbox?.index).toBe(1)
    useUi.getState().lightboxNext() // → 2 (last)
    useUi.getState().lightboxNext() // clamp, stays 2
    expect(useUi.getState().lightbox?.index).toBe(2)
  })

  it('lightboxPrev goes back and clamps at 0 (no wrap)', () => {
    useUi.getState().openLightbox(three, 1, '', 'timeline')
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
