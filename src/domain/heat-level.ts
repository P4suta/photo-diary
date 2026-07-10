/**
 * Single source of truth for the photo-count → heat level bucket (0..4), shared by
 * the calendar month grid and the year heatmap. 0 photos → 0; the callers decide
 * whether a 0-count day renders as level 0 (heatmap, in range) or -1 (calendar, no dot).
 */
export function heatLevel(count: number): number {
  if (count <= 0) return 0
  if (count <= 2) return 1
  if (count <= 5) return 2
  if (count <= 10) return 3
  return 4
}
