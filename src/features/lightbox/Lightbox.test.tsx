import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useUi } from '@/app/ui-store'
import type { DayEntry, Photo } from '@/domain/models'
import type { PhotoLibrary } from '@/domain/ports'
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

/**
 * Stateful timeline library: the lightbox resolves its photos from the timeline cache, so
 * the strip's photos must come back from `listTimeline`, and `toggleStar` must persist (so
 * the optimistic flip and the follow-up refetch agree).
 */
function timelineLibrary(seed: Photo[]): PhotoLibrary {
  const state = seed.map((p) => ({ ...p }))
  const day = (): DayEntry => ({
    kind: 'photos',
    date: '2026-07-05',
    place: null,
    today: false,
    note: null,
    photos: state.map((p) => ({ ...p })),
  })
  return makeFakeLibrary({
    listTimeline: vi.fn(() => Promise.resolve([day()])),
    toggleStar: vi.fn((id: string) => {
      const p = state.find((x) => x.id === id)
      if (p) p.starred = !p.starred
      return Promise.resolve()
    }),
  })
}

/**
 * Stateful highlights library that mirrors the real backend's starred-only filter: an
 * un-starred photo drops out of the highlights query entirely.
 */
function highlightsLibrary(seed: Photo[]): PhotoLibrary {
  const state = seed.map((p) => ({ ...p }))
  return makeFakeLibrary({
    // Async like the real backend (IPC + SQLite), so the optimistic cache write commits a
    // render before the refetch resolves — as it does in production.
    getHighlights: vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10))
      const photos = state.filter((p) => p.starred).map((p) => ({ ...p }))
      return {
        total: photos.length,
        libraryTotal: state.length,
        months: photos.length ? [{ yearMonth: '2026-08', count: photos.length, photos }] : [],
      }
    }),
    toggleStar: vi.fn((id: string) => {
      const p = state.find((x) => x.id === id)
      if (p) p.starred = !p.starred
      return Promise.resolve()
    }),
  })
}

const three = [photo('a'), photo('b'), photo('c')]

function open(ids: string[], index = 0, source: 'timeline' | 'highlights' = 'timeline') {
  act(() => useUi.getState().openLightbox(ids, index, 'July 5', source))
}

describe('Lightbox keyboard', () => {
  it('renders nothing without a lightbox', () => {
    renderWithProviders(<Lightbox />)
    expect(screen.queryByText(/info/)).toBeNull()
  })

  it('→ advances the index and ← goes back (reflected in the footer)', async () => {
    renderWithProviders(<Lightbox />, { library: timelineLibrary(three) })
    open(['a', 'b', 'c'], 0)
    expect(await screen.findByText(/1 \/ 3/)).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText(/2 \/ 3/)).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText(/1 \/ 3/)).toBeInTheDocument()
  })

  it('Escape closes', async () => {
    renderWithProviders(<Lightbox />, { library: timelineLibrary(three) })
    open(['a', 'b', 'c'], 0)
    expect(await screen.findByText(/1 \/ 3/)).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByText(/1 \/ 3/)).toBeNull()
  })

  it('i toggles the info panel', async () => {
    renderWithProviders(<Lightbox />, { library: timelineLibrary(three) })
    open(['a', 'b', 'c'], 0)
    expect(await screen.findByText('Photo info')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'i' })
    expect(screen.queryByText('Photo info')).toBeNull()
    fireEvent.keyDown(window, { key: 'i' })
    expect(screen.getByText('Photo info')).toBeInTheDocument()
  })

  it('S toggles the star and the label follows the resolved photo', async () => {
    const library = timelineLibrary(three)
    renderWithProviders(<Lightbox />, { library })
    open(['a', 'b', 'c'], 0)
    expect(await screen.findByText('★ Pick')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 's' })
    // The optimistic flip writes starred=true into the cache; the refetch keeps it.
    expect(await screen.findByText('★ Picked')).toBeInTheDocument()
    await waitFor(() => expect(library.toggleStar).toHaveBeenCalledWith('a'))
  })

  it('un-starring from Highlights keeps the photo on screen with fresh state', async () => {
    // The un-starred photo is filtered out of the highlights query, but the strip must
    // keep it visible and reflect the new (un-starred) state — the core WS4 drift fix.
    const library = highlightsLibrary([photo('h', { starred: true })])
    renderWithProviders(<Lightbox />, { library })
    open(['h'], 0, 'highlights')
    expect(await screen.findByText('★ Picked')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 's' })
    // Star flips to un-picked and — crucially — the photo does not vanish (footer stays).
    expect(await screen.findByText('★ Pick')).toBeInTheDocument()
    expect(screen.getByText(/1 \/ 1/)).toBeInTheDocument()
    await waitFor(() => expect(library.toggleStar).toHaveBeenCalledWith('h'))
  })
})
