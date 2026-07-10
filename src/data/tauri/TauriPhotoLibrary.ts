import { convertFileSrc } from '@tauri-apps/api/core'
import { buildHeatWeeks, buildMonthCells, buildTimeline, groupHighlights } from '@/domain/build'
import type { MonthCell } from '@/domain/calendar'
import type { HeatWeek } from '@/domain/heatmap'
import type {
  AspectRatio,
  DayEntry,
  HighlightsData,
  ImportProgress,
  ImportResult,
  LibraryStats,
  Photo,
  PlaceFacet,
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
  async listTimeline(): Promise<DayEntry[]> {
    const [photos, notes] = await Promise.all([backend.listPhotos(), backend.listNotes()])
    return buildTimeline(photos.map(mapPhoto), notes, todayParts().iso)
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

  async listPlaceFacets(): Promise<PlaceFacet[]> {
    const facets = await backend.placeFacets()
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
    const n = Number(photoId)
    if (Number.isFinite(n)) await backend.toggleStar(n)
  }
}
