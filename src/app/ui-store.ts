import { create } from 'zustand'
import type { ImportProgress, Photo } from '@/domain/models'

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
  /** Live per-file progress of the running import (null before the first tick). */
  importProgress: ImportProgress | null
  setImportProgress: (progress: ImportProgress | null) => void

  /** i18n key of a transient error toast (null = hidden). */
  toastKey: string | null
  showToast: (key: string) => void
  dismissToast: () => void
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
  importProgress: null,
  setImportProgress: (importProgress) => set({ importProgress }),

  toastKey: null,
  showToast: (toastKey) => set({ toastKey }),
  dismissToast: () => set({ toastKey: null }),
}))
