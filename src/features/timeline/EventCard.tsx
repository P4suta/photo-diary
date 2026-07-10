import { useTranslation } from 'react-i18next'
import type { DayEntry, EventDay } from '@/domain/models'
import { formatDateRange, formatDayLabel } from '@/lib/datetime'
import { ChevronRightIcon } from '@/ui/icons'
import { NoteEditor } from './NoteEditor'

type EventEntry = Extract<DayEntry, { kind: 'event' }>

/** Fold consecutive high-volume days into one "event" card (2c). */
export function EventCard({ day }: { day: EventEntry }) {
  const { t, i18n } = useTranslation()
  return (
    <article className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-baseline gap-2">
          <h3 className="text-[17px] font-semibold border-b border-dashed border-input cursor-text">
            {day.title}
          </h3>
          <span className="ml-auto font-mono text-[11px] text-[color:var(--moss)]">
            {t('unit.photo', { count: day.photoCount })}
          </span>
        </div>
        <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
          {formatDateRange(day.start, day.end, i18n.language)} · {t('event.label')}
        </div>
      </div>

      <div className="grid grid-cols-6 gap-1 px-5 h-[120px]">
        <div className="ph rounded-md col-span-2" />
        <div className="ph rounded-md" />
        <div className="ph rounded-md" />
        <div className="ph rounded-md" />
        <div className="ph rounded-md" />
      </div>

      <div className="px-5 pt-2 pb-2 mt-1">
        {day.days.map((d) => (
          <EventDayRow key={d.date} day={d} />
        ))}
      </div>

      <div className="px-5 pb-4">
        <div className="pt-2 border-t border-border/60">
          <NoteEditor date={day.date} note={day.note} />
        </div>
      </div>
    </article>
  )
}

/** Per-day row. Click is a no-op for now (future: navigate to each day's detail). */
function EventDayRow({ day }: { day: EventDay }) {
  const { t, i18n } = useTranslation()
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 py-2 border-t border-border/60 cursor-pointer hover:bg-accent/50 -mx-2 px-2 rounded-md text-left"
    >
      <span className="font-mono text-[11px] text-muted-foreground w-14 shrink-0">
        {formatDayLabel(day.date, i18n.language)}
      </span>
      <div className="flex gap-1">
        {Array.from({ length: day.thumbs }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static decorative placeholder (no reorder/state)
          <div key={i} className="ph w-8 h-8 rounded-[4px]" />
        ))}
      </div>
      <span className="ml-auto font-mono text-[10px] text-muted-foreground shrink-0">
        {t('unit.photo', { count: day.photoCount })}
        {day.hasNote ? t('event.noteSuffix') : ''}
      </span>
      <ChevronRightIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
    </button>
  )
}
