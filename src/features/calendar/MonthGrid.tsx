import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useCalendarMonth, useTimeline } from '@/app/queries'
import type { MonthCell } from '@/domain/calendar'
import type { DayEntry } from '@/domain/models'
import { cn } from '@/lib/cn'
import { ErrorPanel } from '@/ui/ErrorPanel'
import { heatClass } from './heat'

export function MonthGrid({ year, month }: { year: number; month: number }) {
  const { i18n } = useTranslation()
  const { data: cells, isError, refetch } = useCalendarMonth(year, month)
  const timeline = useTimeline()
  // Weekday headers starting Sunday (2023-01-01 is a Sunday).
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(i18n.language, { weekday: 'short' }).format(new Date(2023, 0, 1 + i)),
  )
  if (isError || timeline.isError) {
    return (
      <div className="mt-5">
        <ErrorPanel onRetry={() => void Promise.all([refetch(), timeline.refetch()])} />
      </div>
    )
  }
  const events = timeline.data?.filter(
    (entry): entry is Extract<DayEntry, { kind: 'event' }> => entry.kind === 'event',
  )
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 mt-5 text-center font-mono text-[10px] text-muted-foreground">
        {weekdays.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5 mt-1.5">
        {cells?.map((c) => (
          <MonthCellView
            key={c.key}
            cell={c}
            year={year}
            month={month}
            event={eventForCell(c, year, month, events ?? [])}
          />
        ))}
      </div>
    </div>
  )
}

interface CalendarEventBand {
  title: string
  date: string
  continuesLeft: boolean
  continuesRight: boolean
}

function eventForCell(
  cell: MonthCell,
  year: number,
  month: number,
  events: Extract<DayEntry, { kind: 'event' }>[],
): CalendarEventBand | undefined {
  if (cell.blank || cell.day == null) return undefined
  const date = `${year}-${String(month).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`
  const event = events.find((candidate) => candidate.start <= date && candidate.end >= date)
  if (!event) return undefined
  const weekday = new Date(Date.UTC(year, month - 1, cell.day)).getUTCDay()
  return {
    title: event.title,
    date,
    continuesLeft: date > event.start && weekday !== 0 && cell.day !== 1,
    continuesRight:
      date < event.end &&
      weekday !== 6 &&
      cell.day !== new Date(Date.UTC(year, month, 0)).getUTCDate(),
  }
}

function MonthCellView({
  cell,
  year,
  month,
  event,
}: {
  cell: MonthCell
  year: number
  month: number
  event?: CalendarEventBand
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  if (cell.blank) return <div className="min-h-[76px] rounded-lg p-2" />

  const marked = cell.count > 0 || cell.hasNote
  return (
    <button
      type="button"
      onClick={() =>
        navigate(
          `/day/${year}-${String(month).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`,
        )
      }
      className={cn(
        'relative min-h-[76px] rounded-lg p-2 pb-4 text-left overflow-hidden',
        cell.isFuture ? 'border border-transparent' : 'border border-border/60 bg-card',
        cell.isToday && 'ring-1 ring-[color:var(--moss)]',
      )}
    >
      <div
        className={cn(
          'text-[12px] leading-none',
          cell.isFuture
            ? 'text-muted-foreground/40'
            : marked
              ? 'text-foreground font-medium'
              : 'text-muted-foreground',
        )}
      >
        {cell.day}
      </div>
      {marked && (
        <div className="flex items-center gap-1 mt-1.5 px-0.5">
          {cell.count > 0 ? (
            <span className={cn('w-2 h-2 rounded-[2px]', heatClass(cell.level))} />
          ) : (
            <span className="w-2 h-[3px] rounded-full bg-muted-foreground/50" />
          )}
          <span className="font-mono text-[9px] text-muted-foreground">
            {cell.count > 0 ? t('unit.photo', { count: cell.count }) : t('calendar.note')}
          </span>
        </div>
      )}
      {event && (
        <span
          role="img"
          data-testid="calendar-event-band"
          data-event-date={event.date}
          aria-label={`${t('event.label')}: ${event.title}`}
          className={cn(
            'absolute bottom-1 h-1.5 bg-[color:var(--moss)]',
            event.continuesLeft ? '-left-2' : 'left-1 rounded-l-full',
            event.continuesRight ? '-right-2' : 'right-1 rounded-r-full',
          )}
        />
      )}
    </button>
  )
}
