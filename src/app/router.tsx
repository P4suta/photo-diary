import { createBrowserRouter } from 'react-router-dom'
import { CalendarView } from '@/features/calendar/CalendarView'
import { HighlightsView } from '@/features/highlights/HighlightsView'
import { SettingsView } from '@/features/library/SettingsView'
import { EmptyState } from '@/features/onboarding/EmptyState'
import { AppShell } from '@/features/shell/AppShell'
import { DayDetailView } from '@/features/timeline/DayDetailView'
import { TimelineView } from '@/features/timeline/TimelineView'
import { TokensView } from '@/features/tokens/TokensView'

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <TimelineView /> },
      { path: 'day', element: <DayDetailView /> },
      { path: '/calendar', element: <CalendarView /> },
      { path: '/highlights', element: <HighlightsView /> },
      { path: '/settings', element: <SettingsView /> },
      { path: '/tokens', element: <TokensView /> },
    ],
  },
  // Onboarding shown when no folder is registered yet (1h) — standalone
  { path: '/welcome', element: <EmptyState /> },
])
