import { convertFileSrc } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import {
  buildHeatWeeks,
  buildMonthCells,
  buildTimelineFromDays,
  groupHighlights,
} from '@/domain/build'
import type { MonthCell } from '@/domain/calendar'
import type { HeatWeek } from '@/domain/heatmap'
import type {
  AspectRatio,
  DayEntry,
  DayPhotosPage,
  DaySummary,
  EventMetadata,
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
import { backend, type PhotoDto } from './commands'

/** Rust's PhotoDto → the port's Photo (thumbPath/storePath converted to asset URLs). */
function mapPhoto(d: PhotoDto): Photo {
  return {
    id: d.id,
    aspect: d.aspect as AspectRatio,
    takenAt: d.takenAt,
    place: d.place,
    starred: d.starred,
    caption: d.caption,
    width: d.width,
    height: d.height,
    megapixels: d.megapixels,
    thumbUrl: d.thumbPath ? convertFileSrc(d.thumbPath) : undefined,
    fullUrl: convertFileSrc(d.storePath),
    sizeBytes: d.sizeBytes,
    format: d.format,
    quality: d.quality,
    originalFilename: d.originalFilename,
    importedAt: d.importedAt,
    lat: d.lat,
    lng: d.lng,
  }
}

function todayParts() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const day = now.getDate()
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return { year, month, day, iso }
}

/**
 * `PhotoLibrary` implementation that calls the real backend (Rust photo-diary-core).
 * Rust returns raw DTOs; presentation (day grouping / heatmap / calendar / highlights)
 * is assembled by pure functions in `@/domain/build`. The UI stays unchanged.
 */
export class TauriPhotoLibrary implements PhotoLibrary {
  async listTimeline(filter?: TimelineFilter): Promise<DayEntry[]> {
    const [days, overrides] = await Promise.all([
      backend.listTimeline(filter),
      backend.listEventOverrides(),
    ])
    return buildTimelineFromDays(
      days.map((day) => ({ ...day, photos: day.photos.map(mapPhoto) })),
      overrides,
      todayParts().iso,
    )
  }

  getDaySummary(date: string): Promise<DaySummary> {
    return backend.getDaySummary(date)
  }

  async getDayPhotos(input: {
    date: string
    cursor?: string | null
    limit?: number
    starredOnly?: boolean
  }): Promise<DayPhotosPage> {
    const page = await backend.getDayPhotos({
      date: input.date,
      cursor: input.cursor,
      limit: input.limit ?? 120,
      starredOnly: input.starredOnly ?? false,
    })
    return { photos: page.photos.map(mapPhoto), nextCursor: page.nextCursor }
  }

  async getMonth(year: number, month: number): Promise<MonthCell[]> {
    const t = todayParts()
    const records = await backend.monthRecords(year, month)
    return buildMonthCells(year, month, records, { year: t.year, month: t.month, day: t.day })
  }

  async getHeatmap(year: number): Promise<HeatWeek[]> {
    const counts = await backend.yearCounts(year)
    return buildHeatWeeks(year, counts, todayParts().iso)
  }

  importFolder(path: string, onProgress?: (p: ImportProgress) => void): Promise<ImportResult> {
    return backend.importFolder(path, onProgress)
  }

  async getHighlights(): Promise<HighlightsData> {
    const [starred, stats] = await Promise.all([backend.listStarred(), backend.getStats()])
    return groupHighlights(starred.map(mapPhoto), stats.photoCount)
  }

  getStats(): Promise<LibraryStats> {
    return backend.getStats()
  }

  async listFolders(): Promise<WatchedFolder[]> {
    const folders = await backend.listFolders()
    return folders.map((f) => ({
      id: f.id,
      path: f.path,
      status: f.status === 'disconnected' ? 'disconnected' : 'watching',
      lastScan: f.lastScan,
      photoCount: f.photoCount,
    }))
  }

  async listPlaceFacets(filter?: TimelineFilter): Promise<PlaceFacet[]> {
    const facets = await backend.placeFacets(filter)
    return facets.map((f) => ({
      label: f.label,
      count: f.count,
      selected: f.selected,
      muted: f.muted,
    }))
  }

  saveNote(date: string, note: string): Promise<void> {
    return backend.saveNote(date, note)
  }

  async toggleStar(photoId: string): Promise<void> {
    await backend.toggleStar(numericId(photoId, 'toggleStar'))
  }

  saveCaption(photoId: string, caption: string): Promise<void> {
    return backend.saveCaption(numericId(photoId, 'saveCaption'), caption)
  }

  setStarred(photoIds: string[], starred: boolean): Promise<void> {
    return backend.setStarred(
      photoIds.map((id) => numericId(id, 'setStarred')),
      starred,
    )
  }

  saveEventMetadata(event: EventMetadata): Promise<void> {
    return backend.saveEventMetadata(event)
  }

  rescanFolder(folderId: string): Promise<ImportResult> {
    return backend.rescanFolder(numericId(folderId, 'rescanFolder'))
  }

  removeFolder(folderId: string): Promise<void> {
    return backend.removeFolder(numericId(folderId, 'removeFolder'))
  }

  setImportPaused(paused: boolean): Promise<void> {
    return backend.setImportPaused(paused)
  }

  getJobState(): Promise<JobState> {
    return backend.getJobState()
  }

  clearThumbnailCache(): Promise<number> {
    return backend.clearThumbnailCache()
  }

  regenerateThumbnailCache(): Promise<ThumbnailCacheResult> {
    return backend.regenerateThumbnailCache()
  }

  openLibrary(): Promise<void> {
    return backend.openLibrary()
  }

  exportPhoto(photoId: string, destination: string): Promise<number> {
    return backend.exportPhoto(numericId(photoId, 'exportPhoto'), destination)
  }

  async subscribeLibraryEvents(listener: (event: LibraryEvent) => void): Promise<() => void> {
    const unlistenChanged = await listen<string>('library://changed', () =>
      listener({ kind: 'changed' }),
    )
    const unlistenPlaces = await listen<{ current: number; total: number }>(
      'library://place-progress',
      ({ payload }) => listener({ kind: 'place-progress', ...payload }),
    )
    return () => {
      unlistenChanged()
      unlistenPlaces()
    }
  }
}

function numericId(value: string, operation: string): number {
  const n = Number(value)
  if (value.trim() === '' || !Number.isInteger(n)) {
    throw new Error(`${operation}: non-numeric id ${JSON.stringify(value)}`)
  }
  return n
}
