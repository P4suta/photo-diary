import { beforeEach, describe, expect, it, vi } from 'vitest'

// The real backend bridge is mocked: this guards TauriPhotoLibrary's own id validation,
// which neither the mock-backed port-contract nor the mock-backed e2e ever exercises.
const toggleStar = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (p: string) => `asset://${p}`,
}))
vi.mock('./commands', () => ({
  backend: { toggleStar: (id: number) => toggleStar(id) },
}))

const { TauriPhotoLibrary } = await import('./TauriPhotoLibrary')

describe('TauriPhotoLibrary.toggleStar', () => {
  const lib = new TauriPhotoLibrary()
  beforeEach(() => toggleStar.mockReset())

  it('forwards a numeric id to the backend', async () => {
    await lib.toggleStar('42')
    expect(toggleStar).toHaveBeenCalledWith(42)
  })

  it('throws on an empty id without touching the backend (Number("") === 0 is finite)', async () => {
    await expect(lib.toggleStar('')).rejects.toThrow()
    expect(toggleStar).not.toHaveBeenCalled()
  })

  it('throws on a non-numeric id without touching the backend', async () => {
    await expect(lib.toggleStar('abc')).rejects.toThrow()
    expect(toggleStar).not.toHaveBeenCalled()
  })
})
