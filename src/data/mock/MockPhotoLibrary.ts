import { buildHeatWeeks, buildMonthCells } from '@/domain/build'
import type { MonthCell } from '@/domain/calendar'
import type { HeatWeek } from '@/domain/heatmap'
import type {
  DayEntry,
  HighlightMonth,
  HighlightsData,
  ImportProgress,
  ImportResult,
  LibraryStats,
  Photo,
  PlaceFacet,
  WatchedFolder,
} from '@/domain/models'
import type { PhotoLibrary } from '@/domain/ports'
import {
  folders,
  heatCounts,
  highlights,
  julyRecords,
  MOCK_TODAY,
  MOCK_TODAY_ISO,
  placeFacets,
  stats,
  timeline,
} from './fixtures'

/**
 * Phase 1 in-memory implementation; swapped for TauriPhotoLibrary in phase 2.
 * The UI depends only on the PhotoLibrary port, so the swap is painless.
 *
 * Views (calendar / heatmap) are derived from raw fixture records through the very
 * same `@/domain/build` functions the real backend uses — one derivation path, no
 * fork. Mutations (saveNote / toggleStar) rebuild state immutably so React Query sees
 * a changed reference and re-renders (mutating a cached object in place would not).
 */
export class MockPhotoLibrary implements PhotoLibrary {
  // Per-instance copies so mutations never touch the shared module fixtures.
  private days: DayEntry[] = timeline.map((d) => ({ ...d }))
  private highlightMonths: HighlightMonth[] = highlights.months.map((m) => ({
    ...m,
    photos: m.photos.map((p) => ({ ...p })),
  }))

  listTimeline(): Promise<DayEntry[]> {
    return Promise.resolve(this.days)
  }

  // Fixed to July 2026: only that month carries records; other months are empty grids.
  getMonth(year: number, month: number): Promise<MonthCell[]> {
    const records = year === 2026 && month === 7 ? julyRecords : []
    return Promise.resolve(buildMonthCells(year, month, records, MOCK_TODAY))
  }

  getHeatmap(year: number): Promise<HeatWeek[]> {
    const counts = year === 2026 ? heatCounts : []
    return Promise.resolve(buildHeatWeeks(year, counts, MOCK_TODAY_ISO))
  }

  getHighlights(): Promise<HighlightsData> {
    // Invariant: only starred photos appear. Filter to the current starred set and
    // recompute counts so the header and per-month totals match what is shown.
    const months: HighlightMonth[] = this.highlightMonths
      .map((m) => {
        const photos = m.photos.filter((p) => p.starred)
        return { yearMonth: m.yearMonth, count: photos.length, photos }
      })
      .filter((m) => m.count > 0)
    const total = months.reduce((n, m) => n + m.count, 0)
    return Promise.resolve({ total, libraryTotal: stats.photoCount, months })
  }

  getStats(): Promise<LibraryStats> {
    return Promise.resolve(stats)
  }

  listFolders(): Promise<WatchedFolder[]> {
    return Promise.resolve(folders)
  }

  listPlaceFacets(): Promise<PlaceFacet[]> {
    return Promise.resolve(placeFacets)
  }

  // Simulate an import so the browser-dev overlay shows real progress (no real files).
  async importFolder(
    _path: string,
    onProgress?: (p: ImportProgress) => void,
  ): Promise<ImportResult> {
    const total = 24
    for (let current = 1; current <= total; current++) {
      onProgress?.({ current, total, filename: `IMG_${1000 + current}.jpg` })
      await new Promise((resolve) => setTimeout(resolve, 60))
    }
    return {
      imported: total,
      skipped: 0,
      skippedUnsupported: 0,
      bytesSaved: 0,
      failed: [],
      scanErrors: [],
    }
  }

  saveNote(date: string, note: string): Promise<void> {
    // Matches the backend's set_note: whitespace-only clears the note (DELETE).
    const isDelete = note.trim() === ''
    const idx = this.days.findIndex((d) => d.date === date)

    if (idx === -1) {
      // Upsert: a note on a date with no card yet creates a note_only day (the core
      // "write a line on a day you took no photos" flow).
      if (!isDelete) {
        const newDay: DayEntry = {
          kind: 'note_only',
          date,
          place: null,
          today: date === MOCK_TODAY_ISO,
          note,
        }
        this.days = [...this.days, newDay].sort((a, b) => (a.date < b.date ? 1 : -1))
      }
      return Promise.resolve()
    }

    const day = this.days[idx]
    let next: DayEntry | null
    if (isDelete) {
      // Clearing a note_only day leaves nothing, so the day drops out (as it would in
      // the backend, where a day exists only via its photos or its note).
      next = day.kind === 'note_only' ? null : day.kind === 'empty' ? day : { ...day, note: null }
    } else {
      next = day.kind === 'empty' ? { ...day, kind: 'note_only', note } : { ...day, note }
    }
    this.days =
      next === null
        ? this.days.filter((_, i) => i !== idx)
        : this.days.map((d, i) => (i === idx ? next : d))
    return Promise.resolve()
  }

  toggleStar(photoId: string): Promise<void> {
    // Rebuild the timeline and highlights immutably so the flip is a fresh reference.
    this.days = this.days.map((d) => {
      if (d.kind === 'photos') return { ...d, photos: flip(d.photos, photoId) }
      if (d.kind === 'digest') return { ...d, cover: flip(d.cover, photoId) }
      return d
    })
    this.highlightMonths = this.highlightMonths.map((m) => ({
      ...m,
      photos: flip(m.photos, photoId),
    }))
    return Promise.resolve()
  }
}

/** Return a new photo array with the matching id's `starred` flipped (others untouched). */
function flip(photos: Photo[], id: string): Photo[] {
  if (!photos.some((p) => p.id === id)) return photos
  return photos.map((p) => (p.id === id ? { ...p, starred: !p.starred } : p))
}
