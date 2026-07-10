/**
 * Calendar month-grid port type. The grid is assembled from real per-day records by
 * `buildMonthCells` in `@/domain/build/calendar`; this module stays type-only so the
 * UI and both PhotoLibrary implementations share one MonthCell shape.
 */

export interface MonthCell {
  key: string
  blank: boolean
  day: number | null
  count: number
  /** Dot intensity (-1: none) */
  level: number
  hasNote: boolean
  isToday: boolean
  isFuture: boolean
}
