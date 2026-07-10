import { describe, expect, it } from 'vitest'
import { useTheme } from './theme'

// setup.ts's beforeEach resets the store to its initial state (mode:'system',
// accent:'moss'). Each test sets the document classes/attributes and localStorage
// explicitly and asserts on them.

describe('useTheme', () => {
  it('setMode("dark") adds .dark to <html> and persists to localStorage', () => {
    useTheme.getState().setMode('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('photo-diary-theme')).toBe('dark')
    expect(useTheme.getState().mode).toBe('dark')
  })

  it('setMode("light") removes .dark', () => {
    useTheme.getState().setMode('dark')
    useTheme.getState().setMode('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(useTheme.getState().mode).toBe('light')
  })

  it('setAccent updates data-accent and localStorage', () => {
    useTheme.getState().setAccent('dusk')
    expect(document.documentElement.getAttribute('data-accent')).toBe('dusk')
    expect(localStorage.getItem('photo-diary-accent')).toBe('dusk')
    expect(useTheme.getState().accent).toBe('dusk')
  })

  it('setShowEmptyDays toggles the empty-day display', () => {
    expect(useTheme.getState().showEmptyDays).toBe(true)
    useTheme.getState().setShowEmptyDays(false)
    expect(useTheme.getState().showEmptyDays).toBe(false)
  })
})
