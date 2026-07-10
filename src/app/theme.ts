import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark' | 'system'
export type Accent = 'moss' | 'dusk' | 'clay'

interface ThemeState {
  mode: ThemeMode
  accent: Accent
  /** Whether the timeline interleaves faint "no-record" days */
  showEmptyDays: boolean
  setMode: (mode: ThemeMode) => void
  setAccent: (accent: Accent) => void
  setShowEmptyDays: (value: boolean) => void
}

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Reflect .dark and data-accent onto <html>. */
function apply(mode: ThemeMode, accent: Accent): void {
  const el = document.documentElement
  el.classList.toggle('dark', mode === 'dark' || (mode === 'system' && prefersDark()))
  el.setAttribute('data-accent', accent)
}

const savedMode = (localStorage.getItem('photo-diary-theme') as ThemeMode | null) ?? 'system'
const savedAccent = (localStorage.getItem('photo-diary-accent') as Accent | null) ?? 'moss'

export const useTheme = create<ThemeState>((set, get) => ({
  mode: savedMode,
  accent: savedAccent,
  showEmptyDays: true,
  setMode: (mode) => {
    localStorage.setItem('photo-diary-theme', mode)
    apply(mode, get().accent)
    set({ mode })
  },
  setAccent: (accent) => {
    localStorage.setItem('photo-diary-accent', accent)
    apply(get().mode, accent)
    set({ accent })
  },
  setShowEmptyDays: (showEmptyDays) => set({ showEmptyDays }),
}))

// Follow OS color-scheme changes (only when mode = system)
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const { mode, accent } = useTheme.getState()
  if (mode === 'system') apply(mode, accent)
})
