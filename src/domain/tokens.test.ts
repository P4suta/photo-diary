import { describe, expect, it } from 'vitest'
import { tokenColor, tokenRows } from './tokens'

describe('tokenColor', () => {
  it('wraps an HSL triple in hsl()', () => {
    expect(tokenColor('40 14% 97%')).toBe('hsl(40 14% 97%)')
    expect(tokenColor('0 0% 100%')).toBe('hsl(0 0% 100%)')
  })

  it('returns a value already in hsl(...) unchanged', () => {
    expect(tokenColor('hsl(155 22% 40%)')).toBe('hsl(155 22% 40%)')
  })
})

describe('tokenRows', () => {
  it('every row has non-empty name/light/dark (invariant vs index.css)', () => {
    expect(tokenRows.length).toBeGreaterThan(0)
    for (const row of tokenRows) {
      expect(row.name).not.toBe('')
      expect(row.light).not.toBe('')
      expect(row.dark).not.toBe('')
    }
  })

  it('every light/dark resolves to a valid color string via tokenColor', () => {
    for (const row of tokenRows) {
      expect(tokenColor(row.light).startsWith('hsl')).toBe(true)
      expect(tokenColor(row.dark).startsWith('hsl')).toBe(true)
    }
  })
})
