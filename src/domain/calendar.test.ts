import { describe, expect, it } from 'vitest'
import { buildMonthCells, type DayRecord } from './calendar'

const records: Record<number, DayRecord> = {
  5: { count: 3, level: 2, hasNote: true },
  10: { count: 0, level: 0, hasNote: true }, // 0 photos but has a note
}

describe('buildMonthCells (legacy opts form)', () => {
  const cells = buildMonthCells({ leadingBlanks: 3, daysInMonth: 31, today: 5, records })

  it('places leadingBlanks blank cells at the front', () => {
    const blanks = cells.filter((c) => c.blank)
    expect(blanks).toHaveLength(3)
    expect(blanks.every((c) => c.day === null)).toBe(true)
  })

  it('produces blanks + one cell per day', () => {
    expect(cells).toHaveLength(3 + 31)
    const days = cells.filter((c) => !c.blank)
    expect(days).toHaveLength(31)
    expect(days[0].day).toBe(1)
    expect(days[30].day).toBe(31)
  })

  it('a recorded day reflects count/level/hasNote', () => {
    const day5 = cells.find((c) => c.day === 5)
    expect(day5).toMatchObject({
      count: 3,
      level: 2,
      hasNote: true,
      isToday: true,
      isFuture: false,
    })
  })

  it('count 0 with a note keeps hasNote but drops level to -1', () => {
    const day10 = cells.find((c) => c.day === 10)
    expect(day10).toMatchObject({ count: 0, level: -1, hasNote: true })
  })

  it('an unrecorded day is count 0 / level -1 / hasNote false', () => {
    const day1 = cells.find((c) => c.day === 1)
    expect(day1).toMatchObject({ count: 0, level: -1, hasNote: false })
  })

  it('only the today cell is isToday; later days are isFuture', () => {
    expect(cells.find((c) => c.day === 5)?.isToday).toBe(true)
    expect(cells.find((c) => c.day === 4)?.isFuture).toBe(false)
    expect(cells.find((c) => c.day === 6)?.isFuture).toBe(true)
    expect(cells.filter((c) => c.isToday)).toHaveLength(1)
  })
})
