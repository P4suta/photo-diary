import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ImportProgress } from '@/domain/models'
import { useLibrary } from './library-context'
import { useToday } from './today'

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
  const today = useToday()
  // `today` in the key rolls the query over at midnight (staleTime is Infinity).
  return useQuery({ queryKey: [...qk.timeline, today], queryFn: () => library.listTimeline() })
}

export function useCalendarMonth(year: number, month: number) {
  const library = useLibrary()
  return useQuery({
    queryKey: [...qk.month, year, month],
    queryFn: () => library.getMonth(year, month),
  })
}

export function useHeatmap(year: number) {
  const library = useLibrary()
  return useQuery({
    queryKey: [...qk.heatmap, year],
    queryFn: () => library.getHeatmap(year),
  })
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

export function useImportFolder() {
  const library = useLibrary()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { path: string; onProgress?: (p: ImportProgress) => void }) =>
      library.importFolder(v.path, v.onProgress),
    // An import can touch photos, days, counts, folders and stats — refetch everything.
    onSuccess: () => qc.invalidateQueries(),
  })
}

export function useSaveNote() {
  const library = useLibrary()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { date: string; note: string }) => library.saveNote(v.date, v.note),
    // A note changes the timeline, the calendar month (hasNote dot) and the day count.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.timeline })
      qc.invalidateQueries({ queryKey: qk.month })
      qc.invalidateQueries({ queryKey: qk.stats })
    },
  })
}

export function useToggleStar() {
  const library = useLibrary()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (photoId: string) => library.toggleStar(photoId),
    // Starring changes the timeline, the highlights grid and the starred count.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.timeline })
      qc.invalidateQueries({ queryKey: qk.highlights })
      qc.invalidateQueries({ queryKey: qk.stats })
    },
  })
}
