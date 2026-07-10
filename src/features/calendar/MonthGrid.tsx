import { useTranslation } from 'react-i18next'
import { useCalendarMonth } from '@/app/queries'
import type { MonthCell } from '@/domain/calendar'
import { cn } from '@/lib/cn'
import { heatClass } from './heat'

export function MonthGrid() {
  const { i18n } = useTranslation()
  const { data: cells } = useCalendarMonth()
  // Weekday headers starting Sunday (2023-01-01 is a Sunday).
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(i18n.language, { weekday: 'short' }).format(new Date(2023, 0, 1 + i)),
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
          <MonthCellView key={c.key} cell={c} />
        ))}
      </div>
    </div>
  )
}

function MonthCellView({ cell }: { cell: MonthCell }) {
  const { t } = useTranslation()
  if (cell.blank) return <div className="min-h-[76px] rounded-lg p-2" />

  const marked = cell.count > 0 || cell.hasNote
  return (
    <div
      className={cn(
        'min-h-[76px] rounded-lg p-2',
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
    </div>
  )
}
