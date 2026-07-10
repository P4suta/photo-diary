import { createContext, type ReactNode, useContext } from 'react'
import type { PhotoLibrary } from '@/domain/ports'

const LibraryContext = createContext<PhotoLibrary | null>(null)

export function LibraryProvider({
  library,
  children,
}: {
  library: PhotoLibrary
  children: ReactNode
}) {
  return <LibraryContext.Provider value={library}>{children}</LibraryContext.Provider>
}

/** Pull the backend (port) out for the UI; never depends on the concrete impl. */
export function useLibrary(): PhotoLibrary {
  const library = useContext(LibraryContext)
  if (!library) throw new Error('useLibrary must be used inside a LibraryProvider')
  return library
}
