import type { MonthCell } from './calendar'
import type { HeatWeek } from './heatmap'
import type { DayEntry, HighlightsData, LibraryStats, PlaceFacet, WatchedFolder } from './models'

/**
 * The backend seam (port). The UI depends only on this interface.
 * Phase 1: MockPhotoLibrary / Phase 2: TauriPhotoLibrary (@tauri-apps/api invoke).
 */
export interface PhotoLibrary {
  /** Timeline (today first, reverse chronological) */
  listTimeline(): Promise<DayEntry[]>
  /** Calendar month grid (fixed to July 2026 in phase 1) */
  getMonth(): Promise<MonthCell[]>
  /** Annual heatmap */
  getHeatmap(): Promise<HeatWeek[]>
  /** Starred highlights */
  getHighlights(): Promise<HighlightsData>
  getStats(): Promise<LibraryStats>
  listFolders(): Promise<WatchedFolder[]>
  /** Place facets for search */
  listPlaceFacets(): Promise<PlaceFacet[]>

  // --- mutations ---
  saveNote(date: string, note: string): Promise<void>
  toggleStar(photoId: string): Promise<void>
}
