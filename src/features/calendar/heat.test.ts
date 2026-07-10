import { describe, expect, it } from 'vitest'
import { heatClass } from './heat'

describe('heatClass', () => {
  it('negative levels (out of range/future) get the faint muted class', () => {
    expect(heatClass(-1)).toBe('bg-muted/30')
    expect(heatClass(-2)).toBe('bg-muted/30')
  })

  it('level 0 is plain muted', () => {
    expect(heatClass(0)).toBe('bg-muted')
  })

  it('levels 1..4 use the heat variable classes', () => {
    expect(heatClass(1)).toBe('bg-[color:var(--heat-1)]')
    expect(heatClass(2)).toBe('bg-[color:var(--heat-2)]')
    expect(heatClass(3)).toBe('bg-[color:var(--heat-3)]')
    expect(heatClass(4)).toBe('bg-[color:var(--heat-4)]')
  })

  it('out-of-range levels fall back to muted', () => {
    expect(heatClass(5)).toBe('bg-muted')
    expect(heatClass(99)).toBe('bg-muted')
  })
})
