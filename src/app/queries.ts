import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DayEntry, HighlightsData, ImportProgress } from '@/domain/models'
import { flipStarInHighlights, flipStarInTimeline } from '@/domain/star'
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
  const today = useToday()
  // `today` in the key rolls the "today" ring over at midnight, like the timeline.
  return useQuery({
    queryKey: [...qk.month, year, month, today],
    queryFn: () => library.getMonth(year, month),
  })
}

export function useHeatmap(year: number) {
  const library = useLibrary()
  const today = useToday()
  // `today` in the key rolls the "today" cell over at midnight, like the timeline.
  return useQuery({
    queryKey: [...qk.heatmap, year, today],
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
    // Optimistically flip the photo in-place across the timeline and highlights caches.
    // This makes the star respond instantly and — crucially — writes the fresh value
    // into the highlights cache *before* the refetch's starred-only filter drops an
    // un-starred photo, so the lightbox can read it (the photo would otherwise vanish
    // with only its stale starred=true ever observed).
    onMutate: async (photoId) => {
      await qc.cancelQueries({ queryKey: qk.timeline })
      await qc.cancelQueries({ queryKey: qk.highlights })
      const prevTimeline = qc.getQueriesData<DayEntry[]>({ queryKey: qk.timeline })
      const prevHighlights = qc.getQueriesData<HighlightsData>({ queryKey: qk.highlights })
      qc.setQueriesData<DayEntry[]>({ queryKey: qk.timeline }, (days) =>
        days ? flipStarInTimeline(days, photoId) : days,
      )
      qc.setQueriesData<HighlightsData>({ queryKey: qk.highlights }, (data) =>
        data ? flipStarInHighlights(data, photoId) : data,
      )
      return { prevTimeline, prevHighlights }
    },
    // On failure, restore both caches to their exact pre-toggle snapshots (rollback).
    onError: (_err, _photoId, ctx) => {
      for (const [key, data] of ctx?.prevTimeline ?? []) qc.setQueryData(key, data)
      for (const [key, data] of ctx?.prevHighlights ?? []) qc.setQueryData(key, data)
    },
    // Reconcile with the backend regardless of outcome. Starring also changes the
    // highlights grid and the starred count.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.timeline })
      qc.invalidateQueries({ queryKey: qk.highlights })
      qc.invalidateQueries({ queryKey: qk.stats })
    },
  })
}
