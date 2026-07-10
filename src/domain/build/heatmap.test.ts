import { describe, expect, it } from 'vitest'
import { buildHeatWeeks } from '@/domain/build/heatmap'
import type { HeatCell, HeatWeek } from '@/domain/heatmap'

/**
 * Deterministic fixtures pivot on 2026:
 * - 2026-01-01 is a Thursday (getDay()=4) → offset=4.
 * - 2026 is not a leap year → daysInYear=365.
 * - 2026-07-05 has day-of-year index 185 (Jan 1 = 0).
 * On the grid, Jan 1 is w=0,d=4 (idx=0); w0's d0..d3 are out-of-range cells.
 */
function cellAt(weeks: HeatWeek[], w: number, d: number): HeatCell {
  return weeks[w].days[d]
}

describe('buildHeatWeeks', () => {
  it('returns 53 weeks × 7 cells with the documented keys', () => {
    const weeks = buildHeatWeeks(2026, [], '2026-07-05')
    expect(weeks).toHaveLength(53)
    expect(weeks[0].key).toBe('w0')
    expect(weeks[52].key).toBe('w52')
    for (const week of weeks) {
      expect(week.days).toHaveLength(7)
    }
    expect(cellAt(weeks, 0, 0).key).toBe('w0d0')
    expect(cellAt(weeks, 3, 5).key).toBe('w3d5')
  })

  it('leading cells before offset (idx<0) are level=-1, count 0', () => {
    const weeks = buildHeatWeeks(2026, [], '2026-07-05')
    for (let d = 0; d < 4; d++) {
      expect(cellAt(weeks, 0, d).level).toBe(-1)
      expect(cellAt(weeks, 0, d).count).toBe(0)
    }
    // d4 is Jan 1 (idx=0), in range. No count → level=0, count 0.
    expect(cellAt(weeks, 0, 4).level).toBe(0)
    expect(cellAt(weeks, 0, 4).count).toBe(0)
  })

  it('cells after today (idx>todayIdx) are future, level=-1', () => {
    const weeks = buildHeatWeeks(2026, [], '2026-07-05')
    // today = 07-05 = idx 185 → w27,d0; idx 186 → w27,d1.
    expect(cellAt(weeks, 27, 0).level).toBe(0) // today (in range)
    expect(cellAt(weeks, 27, 1).level).toBe(-1) // tomorrow (future)
  })

  it('level buckets: assigns 0/1/2/3/4 from the count', () => {
    const counts = [
      { date: '2026-01-01', count: 0 }, // →0
      { date: '2026-01-02', count: 1 }, // 1-2 →1
      { date: '2026-01-03', count: 2 }, // 1-2 →1
      { date: '2026-01-04', count: 3 }, // 3-5 →2
      { date: '2026-01-05', count: 5 }, // 3-5 →2
      { date: '2026-01-06', count: 6 }, // 6-10 →3
      { date: '2026-01-07', count: 10 }, // 6-10 →3
      { date: '2026-01-08', count: 11 }, // 11+ →4
      { date: '2026-01-09', count: 999 }, // 11+ →4
    ]
    const weeks = buildHeatWeeks(2026, counts, '2026-07-05')
    const byDate = (idx: number): HeatCell => {
      const grid = idx + 4 // offset
      return cellAt(weeks, Math.floor(grid / 7), grid % 7)
    }
    expect(byDate(0)).toMatchObject({ level: 0, count: 0 })
    expect(byDate(1)).toMatchObject({ level: 1, count: 1 })
    expect(byDate(2).level).toBe(1)
    expect(byDate(3).level).toBe(2)
    expect(byDate(4).level).toBe(2)
    expect(byDate(5).level).toBe(3)
    expect(byDate(6).level).toBe(3)
    expect(byDate(7)).toMatchObject({ level: 4, count: 11 })
    expect(byDate(8)).toMatchObject({ level: 4, count: 999 })
  })

  it('past year (year < today year): every day is in range, none future', () => {
    const weeks = buildHeatWeeks(2025, [{ date: '2025-12-31', count: 4 }], '2026-07-05')
    // 2025-01-01 is a Wednesday (getDay()=3) → offset=3. Last day idx=364 → grid=367 → w52,d3.
    expect(cellAt(weeks, 52, 3)).toMatchObject({ level: 2, count: 4 }) // 4 → bucket 2
    expect(cellAt(weeks, 0, 3).level).toBe(0) // Jan 1 in range
    expect(cellAt(weeks, 52, 4).level).toBe(-1) // idx 365+ out of range
  })

  it('future year (year > today year): every cell is level=-1', () => {
    const weeks = buildHeatWeeks(2027, [{ date: '2027-06-01', count: 5 }], '2026-07-05')
    for (const week of weeks) {
      for (const cell of week.days) {
        expect(cell.level).toBe(-1)
        expect(cell.count).toBe(0)
      }
    }
  })

  it('leap year (2028): 54 weeks so Dec 31 is not dropped', () => {
    const weeks = buildHeatWeeks(2028, [{ date: '2028-02-29', count: 7 }], '2028-12-31')
    // 2028-01-01 is a Saturday (getDay()=6) → offset=6, 366 days.
    // ceil((6 + 366) / 7) = 54 weeks (a fixed 53 lost Dec 31).
    expect(weeks).toHaveLength(54)
    // Feb 29 day-of-year index = 31 + 28 = 59 (0-based). grid=59+6=65 → w9,d2.
    expect(cellAt(weeks, 9, 2)).toMatchObject({ level: 3, count: 7 }) // 7 → bucket 3
    // Dec 31 idx=365 → grid=371 → w53,d0. Present and in range (would be dropped at 53 weeks).
    expect(cellAt(weeks, 53, 0)).toMatchObject({ level: 0, count: 0 })
    expect(cellAt(weeks, 52, 6).level).toBe(0) // Dec 30 (idx 364), still in range
  })
})
