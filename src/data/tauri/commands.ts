import { invoke } from '@tauri-apps/api/core'

// Typed wrappers matching each #[tauri::command] in src-tauri (the bridge to the real backend).
// The Rust-side DTOs use #[serde(rename_all = "camelCase")], so keys are camelCase.

/** Rust's PhotoDto (thumbPath is converted to thumbUrl via convertFileSrc on the front end). */
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
export interface ImportResult {
  imported: number
  skipped: number
  bytesSaved: number
}

/** Typed invoke surface onto photo-diary-core. */
export const backend = {
  importFolder: (path: string) => invoke<ImportResult>('import_folder', { path }),
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
  setCaption: (photoId: number, caption: string) =>
    invoke<void>('set_caption', { photoId, caption }),
}
