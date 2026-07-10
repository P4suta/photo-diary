/**
 * Pure function that builds the month grid (MonthCell[]) from real data.
 *
 * Takes the per-day summary (day / count / hasNote) returned by the Rust backend
 * and converts it to the port type MonthCell used by the UI. No side effects, depends
 * only on its arguments, and computes dates deterministically via
 * new Date(year, monthIndex, day) (never uses "now").
 */
import type { MonthCell } from '@/domain/calendar'
import { heatLevel } from '@/domain/heat-level'

export function buildMonthCells(
  year: number,
  month: number,
  records: { day: number; count: number; hasNote: boolean }[],
  today: { year: number; month: number; day: number },
): MonthCell[] {
  // month is 1-12.
  const leadingBlanks = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()

  const recMap = new Map<number, { count: number; hasNote: boolean }>()
  for (const r of records) {
    recMap.set(r.day, { count: r.count, hasNote: r.hasNote })
  }

  const todayDate = new Date(today.year, today.month - 1, today.day)
  const cells: MonthCell[] = []

  for (let i = 0; i < leadingBlanks; i++) {
    cells.push({
      key: `blank-${i}`,
      blank: true,
      day: null,
      count: 0,
      level: -1,
      hasNote: false,
      isToday: false,
      isFuture: false,
    })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const rec = recMap.get(d) ?? { count: 0, hasNote: false }
    const isToday = year === today.year && month === today.month && d === today.day
    const isFuture = new Date(year, month - 1, d) > todayDate
    cells.push({
      key: `day-${d}`,
      blank: false,
      day: d,
      count: rec.count,
      level: rec.count > 0 ? heatLevel(rec.count) : -1,
      hasNote: rec.hasNote,
      isToday,
      isFuture,
    })
  }

  return cells
}
