import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type RenderOptions, type RenderResult, render } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { LibraryProvider } from '@/app/library-context'
import type { LibraryStats } from '@/domain/models'
import type { PhotoLibrary } from '@/domain/ports'

/**
 * Disposable test-only QueryClient that won't hang on failed queries/mutations.
 * Distinct from the app's staleTime:Infinity client — the key is disabling retry.
 */
export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })
}

const emptyStats: LibraryStats = {
  usedBytes: 0,
  photoCount: 0,
  dayCount: 0,
  starredCount: 0,
  location: '',
  thumbnailCacheBytes: 0,
  lastImport: '',
}

/** vi.fn-based spy PhotoLibrary; swap individual methods via overrides. */
export function makeFakeLibrary(overrides: Partial<PhotoLibrary> = {}): PhotoLibrary {
  return {
    listTimeline: vi.fn().mockResolvedValue([]),
    getMonth: vi.fn().mockResolvedValue([]),
    getHeatmap: vi.fn().mockResolvedValue([]),
    getHighlights: vi.fn().mockResolvedValue({ total: 0, libraryTotal: 0, months: [] }),
    getStats: vi.fn().mockResolvedValue(emptyStats),
    listFolders: vi.fn().mockResolvedValue([]),
    listPlaceFacets: vi.fn().mockResolvedValue([]),
    importFolder: vi.fn().mockResolvedValue({
      imported: 0,
      skipped: 0,
      skippedUnsupported: 0,
      bytesSaved: 0,
      failed: [],
      scanErrors: [],
    }),
    saveNote: vi.fn().mockResolvedValue(undefined),
    toggleStar: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

interface ProviderOptions extends Omit<RenderOptions, 'wrapper'> {
  library?: PhotoLibrary
  queryClient?: QueryClient
  /** MemoryRouter initial entry (needed by cards that use useNavigate). */
  route?: string
}

type ProviderRender = RenderResult & {
  library: PhotoLibrary
  queryClient: QueryClient
}

/** Render wrapped in QueryClient + LibraryProvider + MemoryRouter. */
export function renderWithProviders(ui: ReactElement, opts: ProviderOptions = {}): ProviderRender {
  const {
    library = makeFakeLibrary(),
    queryClient = makeTestQueryClient(),
    route = '/',
    ...rest
  } = opts

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <LibraryProvider library={library}>
          <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
        </LibraryProvider>
      </QueryClientProvider>
    )
  }

  return { library, queryClient, ...render(ui, { wrapper: Wrapper, ...rest }) }
}
