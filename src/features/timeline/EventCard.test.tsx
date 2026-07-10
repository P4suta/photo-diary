import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { DayEntry } from '@/domain/models'
import { renderWithProviders } from '@/test/utils'
import { EventCard } from './EventCard'

const event: Extract<DayEntry, { kind: 'event' }> = {
  kind: 'event',
  date: '2026-06-27',
  place: 'Kanazawa & Noto',
  today: false,
  title: 'Kanazawa & Noto, 4 days',
  start: '2026-06-24',
  end: '2026-06-27',
  photoCount: 16204,
  days: [
    { date: '2026-06-24', thumbs: 4, photoCount: 842, hasNote: true },
    { date: '2026-06-25', thumbs: 4, photoCount: 4318, hasNote: false },
  ],
  note: null,
}

describe('EventCard', () => {
  it('renders the title, date range, and total count', () => {
    renderWithProviders(<EventCard day={event} />)
    expect(screen.getByText('Kanazawa & Noto, 4 days')).toBeInTheDocument()
    expect(screen.getByText(/June/)).toBeInTheDocument()
    expect(screen.getByText('16,204 photos')).toBeInTheDocument()
  })

  it('renders one row per event day', () => {
    renderWithProviders(<EventCard day={event} />)
    expect(screen.getByText(/Jun 24/)).toBeInTheDocument()
    expect(screen.getByText(/Jun 25/)).toBeInTheDocument()
    // A day with a note shows the " · note" suffix.
    expect(screen.getByText(/842 photos · note/)).toBeInTheDocument()
  })
})
