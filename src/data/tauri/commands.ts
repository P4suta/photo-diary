import { Channel, invoke } from '@tauri-apps/api/core'
import type { ImportProgress } from '@/domain/models'

// Typed wrappers matching each #[tauri::command] in src-tauri (the bridge to the real backend).
// The Rust-side DTOs use #[serde(rename_all = "camelCase")], so keys are camelCase.

/** Rust's PhotoDto (thumbPath/storePath are converted to URLs via convertFileSrc on the front end). */
export interface PhotoDto {
  id: string
  aspect: string
  takenAt: string
  place: string | null
  starred: boolean
  caption: string | null
  width: number
  height: number
  megapixels: number
  thumbPath: string | null
  /** Absolute path of the full-resolution AVIF master (→ fullUrl in the lightbox). */
  storePath: string
  sizeBytes: number
  format: string
  quality: string
  originalFilename: string
  importedAt: string
  lat: number | null
  lng: number | null
}

export interface NoteDto {
  date: string
  note: string
}
export interface DayCountDto {
  date: string
  count: number
}
export interface MonthRecordDto {
  day: number
  count: number
  hasNote: boolean
}
export interface FolderDto {
  id: string
  path: string
  status: string
  lastScan: string
  photoCount: number
}
export interface PlaceFacetDto {
  label: string
  count: number
  selected: boolean
  muted: boolean
}
export interface StatsDto {
  usedBytes: number
  photoCount: number
  dayCount: number
  starredCount: number
  thumbnailCacheBytes: number
  location: string
  lastImport: string
}
export interface ImportFailureDto {
  path: string
  reason: string
}
export interface ImportResultDto {
  imported: number
  skipped: number
  skippedUnsupported: number
  bytesSaved: number
  failed: ImportFailureDto[]
  scanErrors: string[]
}

/** Typed invoke surface onto photo-diary-core. */
export const backend = {
  // The Rust command takes a per-call IPC Channel (`on_progress`), delivered as `onProgress`.
  // One ImportProgress is emitted per processed file; the caller's callback receives each.
  importFolder: (path: string, onProgress?: (p: ImportProgress) => void) => {
    const channel = new Channel<ImportProgress>()
    if (onProgress) channel.onmessage = onProgress
    return invoke<ImportResultDto>('import_folder', { path, onProgress: channel })
  },
  listPhotos: () => invoke<PhotoDto[]>('list_photos'),
  listStarred: () => invoke<PhotoDto[]>('list_starred'),
  listNotes: () => invoke<NoteDto[]>('list_notes'),
  yearCounts: (year: number) => invoke<DayCountDto[]>('year_counts', { year }),
  monthRecords: (year: number, month: number) =>
    invoke<MonthRecordDto[]>('month_records', { year, month }),
  listFolders: () => invoke<FolderDto[]>('list_folders'),
  placeFacets: () => invoke<PlaceFacetDto[]>('place_facets'),
  getStats: () => invoke<StatsDto>('get_stats'),
  saveNote: (date: string, note: string) => invoke<void>('save_note', { date, note }),
  toggleStar: (photoId: number) => invoke<boolean>('toggle_star', { photoId }),
}
