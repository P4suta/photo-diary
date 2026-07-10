import { describe, expect, it } from 'vitest'
import { buildHeatWeeks, levelFor } from './heatmap'

describe('levelFor', () => {
  it('returns an integer in 0..4', () => {
    for (let i = 0; i < 200; i++) {
      const level = levelFor(i)
      expect(Number.isInteger(level)).toBe(true)
      expect(level).toBeGreaterThanOrEqual(0)
      expect(level).toBeLessThanOrEqual(4)
    }
  })

  it('is deterministic (same index → same level)', () => {
    expect(levelFor(42)).toBe(levelFor(42))
    expect(levelFor(0)).toBe(levelFor(0))
  })

  it('produces every level (the pseudo-random source is not skewed)', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 365; i++) seen.add(levelFor(i))
    expect(seen).toEqual(new Set([0, 1, 2, 3, 4]))
  })
})

describe('buildHeatWeeks (legacy mock)', () => {
  const weeks = buildHeatWeeks()

  it('grid of 53 weeks × 7 days', () => {
    expect(weeks).toHaveLength(53)
    for (const w of weeks) expect(w.days).toHaveLength(7)
  })

  it('cells before offset (4) are out of range (level -1, count 0)', () => {
    expect(weeks[0].days[0].level).toBe(-1)
    expect(weeks[0].days[0].count).toBe(0)
  })

  it('recorded up to today (day-of-year index 185), future from the next day (-1)', () => {
    // idx = w*7 + d - 4. 185 → w27 d0, 186 → w27 d1.
    expect(weeks[27].days[0].level).toBeGreaterThanOrEqual(0)
    expect(weeks[27].days[1].level).toBe(-1)
  })

  it('in-range cells carry a fabricated count of level*3', () => {
    const marked = weeks[27].days[0]
    expect(marked.count).toBe(marked.level * 3)
  })

  it('every cell level stays within -1..4', () => {
    for (const w of weeks) {
      for (const c of w.days) {
        expect(c.level).toBeGreaterThanOrEqual(-1)
        expect(c.level).toBeLessThanOrEqual(4)
      }
    }
  })
})
