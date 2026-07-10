import { create } from 'zustand'
import type { Photo } from '@/domain/models'

interface LightboxState {
  photos: Photo[]
  index: number
  /** Heading context (e.g. 'July 4') */
  context: string
}

export type ImportState = 'closed' | 'panel' | 'toast'

interface UiStore {
  lightbox: LightboxState | null
  openLightbox: (photos: Photo[], index: number, context: string) => void
  closeLightbox: () => void
  lightboxNext: () => void
  lightboxPrev: () => void

  importState: ImportState
  setImportState: (state: ImportState) => void
}

export const useUi = create<UiStore>((set) => ({
  lightbox: null,
  openLightbox: (photos, index, context) => set({ lightbox: { photos, index, context } }),
  closeLightbox: () => set({ lightbox: null }),
  lightboxNext: () =>
    set((s) =>
      s.lightbox
        ? {
            lightbox: {
              ...s.lightbox,
              index: Math.min(s.lightbox.index + 1, s.lightbox.photos.length - 1),
            },
          }
        : s,
    ),
  lightboxPrev: () =>
    set((s) =>
      s.lightbox ? { lightbox: { ...s.lightbox, index: Math.max(s.lightbox.index - 1, 0) } } : s,
    ),

  importState: 'closed',
  setImportState: (importState) => set({ importState }),
}))
