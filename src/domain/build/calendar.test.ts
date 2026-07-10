import { describe, expect, it } from 'vitest'
import { buildMonthCells } from '@/domain/build/calendar'
import type { MonthCell } from '@/domain/calendar'

/**
 * Deterministic fixtures cover each branch.
 * Reference month: July 2026 (Jan 1 2026 = Thu → Jul 1 = Wed, getDay()=3, 31 days).
 * Today: 2026-07-05.
 */
const TODAY = { year: 2026, month: 7, day: 5 } as const

function byKey(cells: MonthCell[], key: string): MonthCell {
  const cell = cells.find((c) => c.key === key)
  if (!cell) throw new Error(`no cell ${key}`)
  return cell
}

describe('buildMonthCells', () => {
  it('places leadingBlanks blank cells (July 2026 starts on Wed = 3)', () => {
    const cells = buildMonthCells(2026, 7, [], TODAY)
    const blanks = cells.filter((c) => c.blank)
    expect(blanks).toHaveLength(3)
    expect(blanks[0]).toEqual({
      key: 'blank-0',
      blank: true,
      day: null,
      count: 0,
      level: -1,
      hasNote: false,
      isToday: false,
      isFuture: false,
    })
    expect(blanks[2].key).toBe('blank-2')
    expect(cells[3]).toMatchObject({ key: 'day-1', blank: false, day: 1 })
  })

  it('emits daysInMonth day cells (July 2026 = 31) keyed day-N', () => {
    const cells = buildMonthCells(2026, 7, [], TODAY)
    const days = cells.filter((c) => !c.blank)
    expect(days).toHaveLength(31)
    expect(days[0].key).toBe('day-1')
    expect(days[30].key).toBe('day-31')
    expect(cells).toHaveLength(3 + 31)
  })

  it('an unrecorded day is count=0 / level=-1 / hasNote=false', () => {
    const cells = buildMonthCells(2026, 7, [], TODAY)
    expect(byKey(cells, 'day-10')).toMatchObject({ count: 0, level: -1, hasNote: false })
  })

  it('isToday is true only when year & month & day all match', () => {
    const cells = buildMonthCells(2026, 7, [], TODAY)
    const today = cells.filter((c) => c.isToday)
    expect(today).toHaveLength(1)
    expect(today[0].key).toBe('day-5')
    expect(byKey(cells, 'day-4').isToday).toBe(false)
    expect(byKey(cells, 'day-6').isToday).toBe(false)
  })

  it('a different year/month never sets isToday', () => {
    const augCells = buildMonthCells(2026, 8, [{ day: 5, count: 1, hasNote: false }], TODAY)
    expect(augCells.some((c) => c.isToday)).toBe(false)
    const prevYear = buildMonthCells(2025, 7, [{ day: 5, count: 1, hasNote: false }], TODAY)
    expect(prevYear.some((c) => c.isToday)).toBe(false)
  })

  it('isFuture is true after today, false for today and the past', () => {
    const cells = buildMonthCells(2026, 7, [], TODAY)
    expect(byKey(cells, 'day-4').isFuture).toBe(false)
    expect(byKey(cells, 'day-5').isFuture).toBe(false) // today is not future
    expect(byKey(cells, 'day-6').isFuture).toBe(true)
    expect(byKey(cells, 'day-31').isFuture).toBe(true)
  })

  it('a past month is all non-future; a future month is all future', () => {
    const june = buildMonthCells(2026, 6, [], TODAY).filter((c) => !c.blank)
    expect(june.every((c) => c.isFuture === false)).toBe(true)
    const august = buildMonthCells(2026, 8, [], TODAY).filter((c) => !c.blank)
    expect(august.every((c) => c.isFuture === true)).toBe(true)
  })

  it('level buckets: 1-2=1, 3-5=2, 6-10=3, 11+=4 (boundaries covered)', () => {
    const records = [
      { day: 1, count: 1, hasNote: false }, // 1
      { day: 2, count: 2, hasNote: false }, // 1
      { day: 3, count: 3, hasNote: false }, // 2
      { day: 4, count: 5, hasNote: false }, // 2
      { day: 6, count: 6, hasNote: false }, // 3
      { day: 7, count: 10, hasNote: false }, // 3
      { day: 8, count: 11, hasNote: false }, // 4
      { day: 9, count: 99, hasNote: false }, // 4
    ]
    const cells = buildMonthCells(2026, 7, records, TODAY)
    const lvl = (d: number) => byKey(cells, `day-${d}`).level
    expect(lvl(1)).toBe(1)
    expect(lvl(2)).toBe(1)
    expect(lvl(3)).toBe(2)
    expect(lvl(4)).toBe(2)
    expect(lvl(6)).toBe(3)
    expect(lvl(7)).toBe(3)
    expect(lvl(8)).toBe(4)
    expect(lvl(9)).toBe(4)
  })

  it('reflects count and hasNote from the record map', () => {
    const cells = buildMonthCells(
      2026,
      7,
      [
        { day: 12, count: 4, hasNote: true },
        { day: 20, count: 0, hasNote: true }, // count=0 with a note → level=-1, hasNote=true
      ],
      TODAY,
    )
    expect(byKey(cells, 'day-12')).toMatchObject({ count: 4, level: 2, hasNote: true })
    expect(byKey(cells, 'day-20')).toMatchObject({ count: 0, level: -1, hasNote: true })
  })

  it('non-leap February 2026 has 28 days (month-end calculation)', () => {
    const feb = buildMonthCells(2026, 2, [], TODAY).filter((c) => !c.blank)
    expect(feb).toHaveLength(28)
    expect(feb[feb.length - 1].key).toBe('day-28')
  })

  it('leap-year February 2024 has 29 days', () => {
    const feb = buildMonthCells(2024, 2, [], TODAY).filter((c) => !c.blank)
    expect(feb).toHaveLength(29)
    expect(feb[feb.length - 1].key).toBe('day-29')
  })
})
