import { buildClusters, buildHeatWeeks, buildMonthCells } from '@/domain/build'
import type { MonthCell } from '@/domain/calendar'
import type { HeatWeek } from '@/domain/heatmap'
import type {
  DayEntry,
  DayPhotosPage,
  DaySummary,
  EventMetadata,
  HighlightMonth,
  HighlightsData,
  ImportProgress,
  ImportResult,
  JobState,
  LibraryEvent,
  LibraryStats,
  Photo,
  PlaceFacet,
  ThumbnailCacheResult,
  TimelineFilter,
  WatchedFolder,
} from '@/domain/models'
import type { PhotoLibrary } from '@/domain/ports'
import { flipStarInPhotos, flipStarInTimeline } from '@/domain/star'
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
 * Deterministic in-memory implementation for browser development and tests.
 * Production uses TauriPhotoLibrary behind the same PhotoLibrary port.
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
  private watchedFolders: WatchedFolder[] = folders.map((folder) => ({ ...folder }))
  private paused = false
  private listeners = new Set<(event: LibraryEvent) => void>()

  listTimeline(filter?: TimelineFilter): Promise<DayEntry[]> {
    if (!filter || (!filter.startDate && !filter.endDate && filter.places.length === 0)) {
      return Promise.resolve(this.days)
    }
    const matchesPhoto = (photo: Photo) => {
      const date = photo.takenAt.slice(0, 10)
      if (filter.startDate && date < filter.startDate) return false
      if (filter.endDate && date > filter.endDate) return false
      if (filter.places.length > 0 && !filter.places.includes(photo.place)) return false
      return true
    }
    const out: DayEntry[] = []
    for (const day of this.days) {
      if (day.kind === 'photos') {
        const photos = day.photos.filter(matchesPhoto)
        if (photos.length > 0) out.push({ ...day, photos, place: photos[0].place })
      } else if (day.kind === 'digest') {
        const cover = day.cover.filter(matchesPhoto)
        if (cover.length > 0) out.push({ ...day, cover, photoCount: cover.length })
      } else if (day.kind === 'event') {
        const dateMatches = day.days.some(
          ({ date }) =>
            (!filter.startDate || date >= filter.startDate) &&
            (!filter.endDate || date <= filter.endDate),
        )
        const placeMatches = filter.places.length === 0 || filter.places.includes(day.place)
        if (dateMatches && placeMatches) out.push(day)
      }
    }
    return Promise.resolve(out)
  }

  getDaySummary(date: string): Promise<DaySummary> {
    const day = this.days.find((entry) => entry.date === date)
    const photos = photosForDay(day)
    const photoCount =
      day?.kind === 'digest' || day?.kind === 'event' ? day.photoCount : photos.length
    return Promise.resolve({
      date,
      place: day?.place ?? null,
      photoCount,
      starredCount: photos.filter((photo) => photo.starred).length,
      note: day && day.kind !== 'empty' ? day.note : null,
      clusters: day?.kind === 'digest' ? day.clusters : buildClusters(photos, day?.place ?? null),
    })
  }

  getDayPhotos(input: {
    date: string
    cursor?: string | null
    limit?: number
    starredOnly?: boolean
  }): Promise<DayPhotosPage> {
    const day = this.days.find((entry) => entry.date === input.date)
    let photos =
      day?.kind === 'digest'
        ? Array.from({ length: day.photoCount }, (_, index) => digestPhoto(day, index))
        : photosForDay(day)
    if (input.starredOnly) photos = photos.filter((photo) => photo.starred)
    const offset = input.cursor ? Number(input.cursor) : 0
    const limit = input.limit ?? 120
    const page = photos.slice(offset, offset + limit)
    const next = offset + page.length
    return Promise.resolve({
      photos: page,
      nextCursor: next < photos.length ? String(next) : null,
    })
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
    return Promise.resolve(this.watchedFolders)
  }

  listPlaceFacets(filter?: TimelineFilter): Promise<PlaceFacet[]> {
    if (!filter?.startDate && !filter?.endDate) return Promise.resolve(placeFacets)
    return Promise.resolve(
      placeFacets.map((facet) => ({
        ...facet,
        selected: filter?.places.includes(facet.muted ? null : facet.label) ?? false,
      })),
    )
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
    const result = {
      imported: total,
      skipped: 0,
      skippedUnsupported: 0,
      bytesSaved: 0,
      failed: [],
      scanErrors: [],
    }
    this.emit({ kind: 'changed' })
    return result
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
    this.days = flipStarInTimeline(this.days, photoId)
    this.highlightMonths = this.highlightMonths.map((m) => ({
      ...m,
      photos: flipStarInPhotos(m.photos, photoId),
    }))
    return Promise.resolve()
  }

  saveCaption(photoId: string, caption: string): Promise<void> {
    const value = caption.trim() || null
    this.days = mapTimelinePhotos(this.days, (photo) =>
      photo.id === photoId ? { ...photo, caption: value } : photo,
    )
    this.highlightMonths = this.highlightMonths.map((month) => ({
      ...month,
      photos: month.photos.map((photo) =>
        photo.id === photoId ? { ...photo, caption: value } : photo,
      ),
    }))
    this.emit({ kind: 'changed' })
    return Promise.resolve()
  }

  setStarred(photoIds: string[], starred: boolean): Promise<void> {
    const ids = new Set(photoIds)
    this.days = mapTimelinePhotos(this.days, (photo) =>
      ids.has(photo.id) ? { ...photo, starred } : photo,
    )
    this.highlightMonths = this.highlightMonths.map((month) => ({
      ...month,
      photos: month.photos.map((photo) => (ids.has(photo.id) ? { ...photo, starred } : photo)),
    }))
    this.emit({ kind: 'changed' })
    return Promise.resolve()
  }

  saveEventMetadata(event: EventMetadata): Promise<void> {
    this.days = this.days.map((day) =>
      day.kind === 'event' &&
      (event.id === `event:${day.start}:${day.end}` ||
        (event.startDate === day.start && event.endDate === day.end))
        ? { ...day, title: event.title, note: event.note }
        : day,
    )
    this.emit({ kind: 'changed' })
    return Promise.resolve()
  }

  rescanFolder(_folderId: string): Promise<ImportResult> {
    return Promise.resolve({
      imported: 0,
      skipped: 24,
      skippedUnsupported: 0,
      bytesSaved: 0,
      failed: [],
      scanErrors: [],
    })
  }

  removeFolder(folderId: string): Promise<void> {
    this.watchedFolders = this.watchedFolders.filter((folder) => folder.id !== folderId)
    this.emit({ kind: 'changed' })
    return Promise.resolve()
  }

  setImportPaused(paused: boolean): Promise<void> {
    this.paused = paused
    return Promise.resolve()
  }

  getJobState(): Promise<JobState> {
    return Promise.resolve({ running: false, paused: this.paused })
  }

  clearThumbnailCache(): Promise<number> {
    return Promise.resolve(0)
  }

  regenerateThumbnailCache(): Promise<ThumbnailCacheResult> {
    return Promise.resolve({ regenerated: 0, failed: [] })
  }

  openLibrary(): Promise<void> {
    return Promise.resolve()
  }

  exportPhoto(_photoId: string, _destination: string): Promise<number> {
    return Promise.resolve(0)
  }

  subscribeLibraryEvents(listener: (event: LibraryEvent) => void): Promise<() => void> {
    this.listeners.add(listener)
    return Promise.resolve(() => this.listeners.delete(listener))
  }

  private emit(event: LibraryEvent) {
    for (const listener of this.listeners) listener(event)
  }
}

function photosForDay(day: DayEntry | undefined): Photo[] {
  if (day?.kind === 'photos') return day.photos
  if (day?.kind === 'digest') return day.cover
  return []
}

function digestPhoto(day: Extract<DayEntry, { kind: 'digest' }>, index: number): Photo {
  const source = day.cover[index % day.cover.length]
  const minute = Math.floor((index * 1_439) / Math.max(1, day.photoCount - 1))
  const hourText = String(Math.floor(minute / 60)).padStart(2, '0')
  const minuteText = String(minute % 60).padStart(2, '0')
  return {
    ...source,
    id: `digest:${day.date}:${index}`,
    takenAt: `${day.date}T${hourText}:${minuteText}:00`,
    place: day.place,
  }
}

function mapTimelinePhotos(days: DayEntry[], map: (photo: Photo) => Photo): DayEntry[] {
  return days.map((day) => {
    if (day.kind === 'photos') return { ...day, photos: day.photos.map(map) }
    if (day.kind === 'digest') return { ...day, cover: day.cover.map(map) }
    return day
  })
}
