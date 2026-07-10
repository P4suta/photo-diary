import { describe, expect, it } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('joins classes', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('ignores falsy and resolves conditional classes', () => {
    expect(cn('a', false && 'b', null, undefined, 'c')).toBe('a c')
    expect(cn('base', { active: true, disabled: false })).toBe('base active')
  })

  it('merges tailwind conflicts (last wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
    expect(cn('text-sm text-red-500', 'text-lg')).toBe('text-red-500 text-lg')
  })

  it('flattens arrays', () => {
    expect(cn(['a', 'b'], 'c')).toBe('a b c')
  })
})
