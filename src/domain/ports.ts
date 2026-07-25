import type { MonthCell } from './calendar'
import type { HeatWeek } from './heatmap'
import type {
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
  PlaceFacet,
  ThumbnailCacheResult,
  TimelineFilter,
  WatchedFolder,
} from './models'

/**
 * The backend seam (port). The UI depends only on this interface.
 * Browser development/tests use MockPhotoLibrary; production uses
 * TauriPhotoLibrary through @tauri-apps/api invoke.
 */
export interface PhotoLibrary {
  /** Timeline (today first, reverse chronological) */
  listTimeline(filter?: TimelineFilter): Promise<DayEntry[]>
  getDaySummary(date: string): Promise<DaySummary>
  getDayPhotos(input: {
    date: string
    cursor?: string | null
    limit?: number
    starredOnly?: boolean
  }): Promise<DayPhotosPage>
  /** Calendar month grid for the given year and 1-based month */
  getMonth(year: number, month: number): Promise<MonthCell[]>
  /** Annual heatmap for the given year */
  getHeatmap(year: number): Promise<HeatWeek[]>
  /** Starred highlights */
  getHighlights(): Promise<HighlightsData>
  getStats(): Promise<LibraryStats>
  listFolders(): Promise<WatchedFolder[]>
  /** Place facets for search */
  listPlaceFacets(filter?: TimelineFilter): Promise<PlaceFacet[]>

  // --- mutations ---
  /** Import a folder; `onProgress` (optional) fires once per processed file. */
  importFolder(path: string, onProgress?: (p: ImportProgress) => void): Promise<ImportResult>
  saveNote(date: string, note: string): Promise<void>
  toggleStar(photoId: string): Promise<void>
  saveCaption(photoId: string, caption: string): Promise<void>
  setStarred(photoIds: string[], starred: boolean): Promise<void>
  saveEventMetadata(event: EventMetadata): Promise<void>
  rescanFolder(folderId: string): Promise<ImportResult>
  removeFolder(folderId: string): Promise<void>
  setImportPaused(paused: boolean): Promise<void>
  getJobState(): Promise<JobState>
  clearThumbnailCache(): Promise<number>
  regenerateThumbnailCache(): Promise<ThumbnailCacheResult>
  openLibrary(): Promise<void>
  exportPhoto(photoId: string, destination: string): Promise<number>
  subscribeLibraryEvents(listener: (event: LibraryEvent) => void): Promise<() => void>
}
