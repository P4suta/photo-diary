/**
 * Real data → year heatmap (HeatWeek[]), pure.
 *
 * Takes the per-day counts the Rust backend returns (`{ date, count }[]`) and
 * converts them into the port types (HeatWeek / HeatCell) from '@/domain/heatmap'.
 * No side effects, no "now" (today comes in as todayIso). Deterministic.
 */

import type { HeatCell, HeatWeek } from '@/domain/heatmap'

/** count → level bucket (1..4). Zero counts get 0 assigned by the caller. */
function bucket(count: number): number {
  if (count <= 2) return 1
  if (count <= 5) return 2
  if (count <= 10) return 3
  return 4
}

/** Gregorian leap-year test. */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/** Format a local date as 'YYYY-MM-DD' (local getters to avoid timezone drift). */
function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Build the full 53-week heatmap for `year`.
 *
 * - countsMap: date('YYYY-MM-DD') → count.
 * - offset: weekday of Jan 1 (Sunday=0). Leading blank days in the grid.
 * - daysInYear: 366 in a leap year, else 365.
 * - todayIdx: if year is the current (in-progress) year, "today"'s 0-based
 *   day-of-year index; if year is past, daysInYear-1 (all past = shown); if
 *   future, -1 (all future = hidden).
 * - Cell: idx = w*7 + d - offset. Out of range or future (idx > todayIdx) → level=-1;
 *   otherwise look up count → 0 count → 0, else → bucket.
 */
export function buildHeatWeeks(
  year: number,
  counts: { date: string; count: number }[],
  todayIso: string,
): HeatWeek[] {
  const countsMap: Record<string, number> = {}
  for (const { date, count } of counts) {
    countsMap[date] = count
  }

  const offset = new Date(year, 0, 1).getDay()
  const daysInYear = isLeapYear(year) ? 366 : 365

  const todayYear = new Date(`${todayIso}T00:00:00`).getFullYear()
  let todayIdx: number
  if (todayYear === year) {
    // Days elapsed since Jan 1 of this year (0-based).
    const jan1 = new Date(year, 0, 1)
    const todayDate = new Date(`${todayIso}T00:00:00`)
    todayIdx = Math.round((todayDate.getTime() - jan1.getTime()) / 86_400_000)
  } else if (year < todayYear) {
    todayIdx = daysInYear - 1 // all past
  } else {
    todayIdx = -1 // all future
  }

  const weeks: HeatWeek[] = []
  for (let w = 0; w < 53; w++) {
    const days: HeatCell[] = []
    for (let d = 0; d < 7; d++) {
      const idx = w * 7 + d - offset
      const outOfRange = idx < 0 || idx >= daysInYear || idx > todayIdx
      let level: number
      let count = 0
      if (outOfRange) {
        level = -1
      } else {
        const date = toIsoDate(new Date(year, 0, 1 + idx))
        count = countsMap[date] ?? 0
        level = count === 0 ? 0 : bucket(count)
      }
      days.push({ key: `w${w}d${d}`, level, count })
    }
    weeks.push({ key: `w${w}`, days })
  }
  return weeks
}
