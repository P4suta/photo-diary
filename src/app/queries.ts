import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLibrary } from './library-context'

export const qk = {
  timeline: ['timeline'] as const,
  month: ['month'] as const,
  heatmap: ['heatmap'] as const,
  highlights: ['highlights'] as const,
  stats: ['stats'] as const,
  folders: ['folders'] as const,
  placeFacets: ['placeFacets'] as const,
}

export function useTimeline() {
  const library = useLibrary()
  return useQuery({ queryKey: qk.timeline, queryFn: () => library.listTimeline() })
}

export function useCalendarMonth() {
  const library = useLibrary()
  return useQuery({ queryKey: qk.month, queryFn: () => library.getMonth() })
}

export function useHeatmap() {
  const library = useLibrary()
  return useQuery({ queryKey: qk.heatmap, queryFn: () => library.getHeatmap() })
}

export function useHighlights() {
  const library = useLibrary()
  return useQuery({ queryKey: qk.highlights, queryFn: () => library.getHighlights() })
}

export function useStats() {
  const library = useLibrary()
  return useQuery({ queryKey: qk.stats, queryFn: () => library.getStats() })
}

export function useFolders() {
  const library = useLibrary()
  return useQuery({ queryKey: qk.folders, queryFn: () => library.listFolders() })
}

export function usePlaceFacets() {
  const library = useLibrary()
  return useQuery({ queryKey: qk.placeFacets, queryFn: () => library.listPlaceFacets() })
}

export function useSaveNote() {
  const library = useLibrary()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { date: string; note: string }) => library.saveNote(v.date, v.note),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.timeline }),
  })
}

export function useToggleStar() {
  const library = useLibrary()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (photoId: string) => library.toggleStar(photoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.timeline })
      qc.invalidateQueries({ queryKey: qk.highlights })
    },
  })
}
