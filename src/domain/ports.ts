import type { MonthCell } from './calendar'
import type { HeatWeek } from './heatmap'
import type {
  DayEntry,
  HighlightsData,
  ImportProgress,
  ImportResult,
  LibraryStats,
  PlaceFacet,
  WatchedFolder,
} from './models'

/**
 * The backend seam (port). The UI depends only on this interface.
 * Phase 1: MockPhotoLibrary / Phase 2: TauriPhotoLibrary (@tauri-apps/api invoke).
 */
export interface PhotoLibrary {
  /** Timeline (today first, reverse chronological) */
  listTimeline(): Promise<DayEntry[]>
  /** Calendar month grid for the given year and 1-based month */
  getMonth(year: number, month: number): Promise<MonthCell[]>
  /** Annual heatmap for the given year */
  getHeatmap(year: number): Promise<HeatWeek[]>
  /** Starred highlights */
  getHighlights(): Promise<HighlightsData>
  getStats(): Promise<LibraryStats>
  listFolders(): Promise<WatchedFolder[]>
  /** Place facets for search */
  listPlaceFacets(): Promise<PlaceFacet[]>

  // --- mutations ---
  /** Import a folder; `onProgress` (optional) fires once per processed file. */
  importFolder(path: string, onProgress?: (p: ImportProgress) => void): Promise<ImportResult>
  saveNote(date: string, note: string): Promise<void>
  toggleStar(photoId: string): Promise<void>
}
