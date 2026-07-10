import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Photo } from '@/domain/models'
import { makeFakeLibrary, renderWithProviders } from '@/test/utils'
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

describe('PhotoTile', () => {
  it('the open button has the "Open photo" label and reflects the aspect ratio', () => {
    renderWithProviders(<PhotoTile photo={photo({ aspect: '1/1' })} />)
    const open = screen.getByLabelText('Open photo')
    expect(open.className).toContain('aspect-square')
  })

  it('starred shows a badge span; unstarred does not', () => {
    const { unmount } = renderWithProviders(<PhotoTile photo={photo({ starred: true })} />)
    expect(screen.getByText('★', { selector: 'span' })).toBeInTheDocument()
    unmount()
    renderWithProviders(<PhotoTile photo={photo({ starred: false })} />)
    expect(screen.queryByText('★', { selector: 'span' })).toBeNull()
  })

  it('renders a caption when present, nothing when absent', () => {
    const { unmount } = renderWithProviders(
      <PhotoTile photo={photo({ caption: 'Below the lighthouse.' })} />,
    )
    expect(screen.getByText('Below the lighthouse.')).toBeInTheDocument()
    unmount()
    renderWithProviders(<PhotoTile photo={photo({ caption: null })} />)
    expect(screen.queryByText('Below the lighthouse.')).toBeNull()
  })

  it('clicking the tile calls onOpen', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    renderWithProviders(<PhotoTile photo={photo()} onOpen={onOpen} />)
    await user.click(screen.getByLabelText('Open photo'))
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('the hover ★ button calls toggleStar(photo.id)', async () => {
    const user = userEvent.setup()
    const library = makeFakeLibrary()
    renderWithProviders(<PhotoTile photo={photo({ id: 'star-me' })} />, { library })
    await user.click(screen.getByText('★', { selector: 'button' }))
    expect(library.toggleStar).toHaveBeenCalledWith('star-me')
  })
})
