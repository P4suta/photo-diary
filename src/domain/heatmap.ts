/**
 * Year heatmap generation (a pure port of support.js seeded/levelFor/buildHeatWeeks).
 * It uses a deterministic pseudo-random source (no Math.random), so the output is
 * identical every time. Presentation (the tooltip) is left to the UI.
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

function seeded(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

export function levelFor(i: number): number {
  const r = seeded(i)
  if (r < 0.32) return 0
  if (r < 0.58) return 1
  if (r < 0.78) return 2
  if (r < 0.93) return 3
  return 4
}

/**
 * 2026: Jan 1 is a Thursday (offset 4 with a Sunday start). Today = Jul 5
 * (day-of-year index 185).
 */
export function buildHeatWeeks(): HeatWeek[] {
  const offset = 4
  const todayIdx = 185
  const daysInYear = 365
  const weeks: HeatWeek[] = []
  for (let w = 0; w < 53; w++) {
    const days: HeatCell[] = []
    for (let d = 0; d < 7; d++) {
      const idx = w * 7 + d - offset
      const level = idx < 0 || idx >= daysInYear || idx > todayIdx ? -1 : levelFor(idx)
      // Fabricate a plausible count for the mock (level*3); the UI formats the tooltip.
      days.push({ key: `w${w}d${d}`, level, count: level >= 0 ? level * 3 : 0 })
    }
    weeks.push({ key: `w${w}`, days })
  }
  return weeks
}
