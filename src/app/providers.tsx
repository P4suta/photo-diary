import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { MockPhotoLibrary } from '@/data/mock/MockPhotoLibrary'
import { TauriPhotoLibrary } from '@/data/tauri/TauriPhotoLibrary'
import type { PhotoLibrary } from '@/domain/ports'
import { isTauri } from './env'
import { LibraryProvider } from './library-context'
import { useUi } from './ui-store'

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // Any failed query surfaces as a toast so a backend failure isn't silent.
        queryCache: new QueryCache({
          onError: () => useUi.getState().showToast('errors.loadFailed'),
        }),
        defaultOptions: {
          queries: { staleTime: Number.POSITIVE_INFINITY, refetchOnWindowFocus: false },
        },
      }),
  )
  // Inject the real backend adapter only under Tauri (browser dev uses the mock).
  const [library] = useState<PhotoLibrary>(() =>
    isTauri ? new TauriPhotoLibrary() : new MockPhotoLibrary(),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <LibraryProvider library={library}>{children}</LibraryProvider>
    </QueryClientProvider>
  )
}
