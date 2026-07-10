/** Builds month-grid cells (a clean reconstruction of buildMonthCells from support.js). */

export interface DayRecord {
  count: number
  level: number
  hasNote: boolean
}

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

export function buildMonthCells(opts: {
  leadingBlanks: number
  daysInMonth: number
  today: number
  records: Record<number, DayRecord>
}): MonthCell[] {
  const cells: MonthCell[] = []
  for (let i = 0; i < opts.leadingBlanks; i++) {
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
  for (let d = 1; d <= opts.daysInMonth; d++) {
    const rec = opts.records[d]
    cells.push({
      key: `day-${d}`,
      blank: false,
      day: d,
      count: rec?.count ?? 0,
      level: rec && rec.count > 0 ? rec.level : -1,
      hasNote: rec?.hasNote ?? false,
      isToday: d === opts.today,
      isFuture: d > opts.today,
    })
  }
  return cells
}
