import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { makeFakeLibrary, makeTestQueryClient } from '@/test/utils'
import { LibraryProvider } from './library-context'
import { qk, useSaveNote, useToggleStar } from './queries'

/** renderHook wrapper with just QueryClient + LibraryProvider. */
function setup(library = makeFakeLibrary()) {
  const queryClient = makeTestQueryClient()
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <LibraryProvider library={library}>{children}</LibraryProvider>
    </QueryClientProvider>
  )
  return { queryClient, invalidate, wrapper, library }
}

describe('useSaveNote', () => {
  it('invalidates the timeline on success', async () => {
    const { invalidate, wrapper, library } = setup()
    const { result } = renderHook(() => useSaveNote(), { wrapper })
    await result.current.mutateAsync({ date: '2026-07-05', note: 'memo' })
    expect(library.saveNote).toHaveBeenCalledWith('2026-07-05', 'memo')
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.timeline }))
  })
})

describe('useToggleStar', () => {
  it('invalidates both timeline and highlights on success', async () => {
    const { invalidate, wrapper, library } = setup()
    const { result } = renderHook(() => useToggleStar(), { wrapper })
    await result.current.mutateAsync('p1')
    expect(library.toggleStar).toHaveBeenCalledWith('p1')
    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.timeline })
      expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.highlights })
    })
  })
})
