import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useSaveEventMetadata } from '@/app/queries'
import type { DayEntry, EventDay } from '@/domain/models'
import { formatDateRange, formatDayLabel } from '@/lib/datetime'
import { ChevronRightIcon } from '@/ui/icons'

type EventEntry = Extract<DayEntry, { kind: 'event' }>

/** Fold consecutive high-volume days into one "event" card (2c). */
export function EventCard({ day }: { day: EventEntry }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const saveEvent = useSaveEventMetadata()
  const [title, setTitle] = useState(day.title)
  const [note, setNote] = useState(day.note ?? '')
  const skipTitleSave = useRef(false)
  const skipNoteSave = useRef(false)
  useEffect(() => setTitle(day.title), [day.title])
  useEffect(() => setNote(day.note ?? ''), [day.note])
  const persist = (nextTitle = title, nextNote = note) =>
    saveEvent.mutate({
      id: `event:${day.start}:${day.end}`,
      startDate: day.start,
      endDate: day.end,
      title: nextTitle.trim() || day.title,
      note: nextNote.trim() || null,
    })
  return (
    <article className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-baseline gap-2">
          <input
            aria-label={t('event.title')}
            value={title}
            onChange={(event) => setTitle(event.target.value.replace(/\r?\n/g, ' '))}
            onBlur={() => {
              if (skipTitleSave.current) {
                skipTitleSave.current = false
              } else {
                persist()
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') {
                skipTitleSave.current = true
                setTitle(day.title)
                event.currentTarget.blur()
              }
            }}
            className="min-w-0 flex-1 bg-transparent text-[17px] font-semibold border-b border-dashed border-input outline-none"
          />
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
          <EventDayRow key={d.date} day={d} onOpen={() => navigate(`/day/${d.date}`)} />
        ))}
      </div>

      <div className="px-5 pb-4">
        <div className="pt-2 border-t border-border/60">
          <textarea
            aria-label={t('event.note')}
            value={note}
            rows={2}
            placeholder={t('event.notePlaceholder')}
            onChange={(event) => setNote(event.target.value)}
            onBlur={() => {
              if (skipNoteSave.current) {
                skipNoteSave.current = false
              } else {
                persist()
              }
            }}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.currentTarget.blur()
              }
              if (event.key === 'Escape') {
                skipNoteSave.current = true
                setNote(day.note ?? '')
                event.currentTarget.blur()
              }
            }}
            className="w-full resize-none bg-transparent text-[13px] leading-5 outline-none placeholder:text-muted-foreground/50"
          />
        </div>
      </div>
    </article>
  )
}

function EventDayRow({ day, onOpen }: { day: EventDay; onOpen: () => void }) {
  const { t, i18n } = useTranslation()
  return (
    <button
      type="button"
      onClick={onOpen}
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
