import { create } from 'zustand'
import type { ImportProgress } from '@/domain/models'

/** Which query cache backs the open strip, so the lightbox resolves live photos from it. */
export type LightboxSource = 'timeline' | 'highlights'

export interface LightboxState {
  /** Photo ids of the strip; the actual photos are resolved live from `source`'s cache. */
  ids: string[]
  index: number
  /** Heading context (e.g. 'July 4') */
  context: string
  source: LightboxSource
}

export type ImportState = 'closed' | 'panel' | 'toast'

interface UiStore {
  lightbox: LightboxState | null
  openLightbox: (ids: string[], index: number, context: string, source: LightboxSource) => void
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
  /** Interpolation params for the toast's i18n key (e.g. import failure counts). */
  toastParams?: Record<string, unknown>
  showToast: (key: string, params?: Record<string, unknown>) => void
  dismissToast: () => void
}

export const useUi = create<UiStore>((set) => ({
  lightbox: null,
  openLightbox: (ids, index, context, source) => set({ lightbox: { ids, index, context, source } }),
  closeLightbox: () => set({ lightbox: null }),
  lightboxNext: () =>
    set((s) =>
      s.lightbox
        ? {
            lightbox: {
              ...s.lightbox,
              index: Math.min(s.lightbox.index + 1, s.lightbox.ids.length - 1),
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
  toastParams: undefined,
  // Always replace params (never merge) so a later toast can't inherit stale counts.
  showToast: (toastKey, toastParams) => set({ toastKey, toastParams }),
  dismissToast: () => set({ toastKey: null, toastParams: undefined }),
}))
