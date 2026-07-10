/**
 * Year heatmap port types. The weeks are assembled from real per-day counts by
 * `buildHeatWeeks` in `@/domain/build/heatmap`; this module stays type-only so the
 * UI and both PhotoLibrary implementations share one HeatWeek/HeatCell shape.
 */

export interface HeatCell {
  key: string
  /** -1: out of range/future, 0..4: recorded volume. */
  level: number
  /** Photo count for the day (0 when none); the UI formats the tooltip. */
  count: number
}

export interface HeatWeek {
  key: string
  days: HeatCell[]
}
