import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useUi } from '@/app/ui-store'
import type { Photo } from '@/domain/models'
import { makeFakeLibrary, renderWithProviders } from '@/test/utils'
import { Lightbox } from './Lightbox'

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

const three = [photo('a'), photo('b'), photo('c')]

function open(photos: Photo[], index = 0) {
  act(() => useUi.getState().openLightbox(photos, index, 'July 5'))
}

describe('Lightbox keyboard', () => {
  it('renders nothing without a lightbox', () => {
    renderWithProviders(<Lightbox />)
    expect(screen.queryByText(/info/)).toBeNull()
  })

  it('→ advances the index and ← goes back (reflected in the footer)', () => {
    renderWithProviders(<Lightbox />)
    open(three, 0)
    expect(screen.getByText(/1 \/ 3/)).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText(/2 \/ 3/)).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText(/1 \/ 3/)).toBeInTheDocument()
  })

  it('Escape closes', () => {
    renderWithProviders(<Lightbox />)
    open(three, 0)
    expect(screen.getByText(/1 \/ 3/)).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByText(/1 \/ 3/)).toBeNull()
  })

  it('i toggles the info panel', () => {
    renderWithProviders(<Lightbox />)
    open(three, 0)
    expect(screen.getByText('Photo info')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'i' })
    expect(screen.queryByText('Photo info')).toBeNull()
    fireEvent.keyDown(window, { key: 'i' })
    expect(screen.getByText('Photo info')).toBeInTheDocument()
  })

  it('S toggles the star and flips the star label', async () => {
    const library = makeFakeLibrary()
    renderWithProviders(<Lightbox />, { library })
    open(three, 0)
    expect(screen.getByText('★ Pick')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 's' })
    // The label flips synchronously; the mutate is async so wait for it.
    expect(screen.getByText('★ Picked')).toBeInTheDocument()
    await waitFor(() => expect(library.toggleStar).toHaveBeenCalledWith('a'))
  })
})
