import { describe, expect, it } from 'vitest'
import { formatBytes, formatCount, splitBytes } from './format'

describe('formatCount', () => {
  it('groups thousands with commas', () => {
    expect(formatCount(8214)).toBe('8,214')
    expect(formatCount(1_000_000)).toBe('1,000,000')
  })

  it('leaves values under 1000 as-is', () => {
    expect(formatCount(0)).toBe('0')
    expect(formatCount(999)).toBe('999')
  })
})

describe('formatBytes', () => {
  it('GB with one decimal', () => {
    expect(formatBytes(13_314_398_618)).toBe('12.4 GB')
    expect(formatBytes(1024 ** 3)).toBe('1.0 GB') // exactly 1 GB
  })

  it('MB integer at ≥100, two decimals below', () => {
    expect(formatBytes(150 * 1024 ** 2)).toBe('150 MB')
    expect(formatBytes(100 * 1024 ** 2)).toBe('100 MB') // 100 is on the integer side
    expect(formatBytes(12.5 * 1024 ** 2)).toBe('12.50 MB')
    expect(formatBytes(1024 ** 2)).toBe('1.00 MB') // exactly 1 MB
  })

  it('KB rounded to an integer', () => {
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(1024)).toBe('1 KB') // exactly 1 KB
    expect(formatBytes(1536)).toBe('2 KB') // 1.5 → rounds up
  })

  it('below 1 KB is raw bytes', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1023)).toBe('1023 B') // just below the KB boundary
  })
})

describe('splitBytes', () => {
  it('splits value and unit', () => {
    expect(splitBytes(13_314_398_618)).toEqual({ value: '12.4', unit: 'GB' })
    expect(splitBytes(512)).toEqual({ value: '512', unit: 'B' })
  })

  it('0 splits into 0 B', () => {
    expect(splitBytes(0)).toEqual({ value: '0', unit: 'B' })
  })
})
