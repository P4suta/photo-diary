/**
 * Domain model — pure types with no dependency on React or the UI.
 * In phase 2 the Rust core (Tauri) returns JSON shaped to match these.
 *
 * Presentation (weekday / month-day strings, "N photos") is intentionally NOT
 * baked in here: dates stay raw and the UI formats them per locale (Intl).
 */

export type AspectRatio = '4/3' | '3/4' | '1/1'

export interface Photo {
  id: string
  aspect: AspectRatio
  /** Capture timestamp (ISO, local). */
  takenAt: string
  place: string | null
  starred: boolean
  /** One-line caption shown on the tile / lightbox. */
  caption: string | null
  width: number
  height: number
  megapixels: number
  /** Display thumbnail URL (Tauri: convertFileSrc; mock: unset → .ph placeholder). */
  thumbUrl?: string
  /** Full-resolution AVIF master URL (Tauri: convertFileSrc of store_path; mock: unset). */
  fullUrl?: string
  /** Stored size in the internal library (AVIF, bytes). */
  sizeBytes: number
  format: string
  quality: string
  originalFilename: string
  importedAt: string
  lat: number | null
  lng: number | null
}

/** A "chapter" of a high-volume day (auto-clustered by EXIF capture gaps). */
export interface TimeCluster {
  /** 'HH:MM' of the first photo. */
  time: string
  label: string
  count: number
}

interface DayCommon {
  /** 'YYYY-MM-DD' */
  date: string
  place: string | null
  today: boolean
}

/**
 * One day = one card. The capture/writing state is a discriminated union, and
 * card components render each variant through an exhaustive switch on `kind`.
 */
export type DayEntry =
  | (DayCommon & { kind: 'photos'; photos: Photo[]; note: string | null })
  | (DayCommon & { kind: 'note_only'; note: string })
  | (DayCommon & { kind: 'empty' })
  | (DayCommon & {
      kind: 'digest'
      photoCount: number
      cover: Photo[]
      clusters: TimeCluster[]
      note: string | null
    })
  | (DayCommon & {
      kind: 'event'
      title: string
      /** Inclusive event span as raw 'YYYY-MM-DD' dates; the UI formats the range. */
      start: string
      end: string
      photoCount: number
      days: EventDay[]
      note: string | null
    })

export type DayKind = DayEntry['kind']

/** One day-row of an event (multi-day trip) card. */
export interface EventDay {
  /** 'YYYY-MM-DD'; the UI formats the day label. */
  date: string
  thumbs: number
  photoCount: number
  hasNote: boolean
}

export interface WatchedFolder {
  id: string
  path: string
  status: 'watching' | 'disconnected'
  lastScan: string
  photoCount: number
}

export interface LibraryStats {
  usedBytes: number
  photoCount: number
  dayCount: number
  starredCount: number
  location: string
  thumbnailCacheBytes: number
  lastImport: string
}

export interface HighlightMonth {
  /** 'YYYY-MM'; the UI formats the month label. */
  yearMonth: string
  count: number
  photos: Photo[]
}

export interface HighlightsData {
  total: number
  libraryTotal: number
  months: HighlightMonth[]
}

/** Place facet for search. */
export interface PlaceFacet {
  label: string
  count: number
  selected: boolean
  muted?: boolean
}

/** One file that failed to import (the rest of the folder still imported). */
export interface ImportFailure {
  path: string
  reason: string
}

/** Result of importing a folder (matches the Rust core's ImportSummary). */
export interface ImportResult {
  imported: number
  skipped: number
  /** Recognized-but-undecodable files (heic/heif/avif) skipped by policy. */
  skippedUnsupported: number
  /** Total originals − total stored (AVIF); can be negative. */
  bytesSaved: number
  failed: ImportFailure[]
  scanErrors: string[]
}

/** Progress for one processed file during an import (emitted per file). */
export interface ImportProgress {
  current: number
  total: number
  filename: string
}
