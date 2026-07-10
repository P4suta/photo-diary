import { useTranslation } from 'react-i18next'
import { useUi } from '@/app/ui-store'
import type { DayEntry } from '@/domain/models'
import { cn } from '@/lib/cn'
import { formatMonthDay, formatShortWeekday } from '@/lib/datetime'
import { PhotoTile } from '@/ui/PhotoTile'
import { DayHeader } from './DayHeader'
import { DigestCard } from './DigestCard'
import { EventCard } from './EventCard'
import { NoteEditor } from './NoteEditor'

/** One day = one card, rendered by an exhaustive switch on `kind`. */
export function DayCard({ day }: { day: DayEntry }) {
  switch (day.kind) {
    case 'empty':
      return <EmptyDayRow date={day.date} />
    case 'note_only':
      return <NoteOnlyCard day={day} />
    case 'photos':
      return <PhotosCard day={day} />
    case 'digest':
      return <DigestCard day={day} />
    case 'event':
      return <EventCard day={day} />
    default:
      return assertNever(day)
  }
}

function assertNever(x: never): never {
  throw new Error(`Unhandled DayEntry: ${JSON.stringify(x)}`)
}

function EmptyDayRow({ date }: { date: string }) {
  const { t, i18n } = useTranslation()
  return (
    <div className="flex items-center gap-3 px-1 text-[12px] text-muted-foreground/60">
      <div className="h-px flex-1 bg-border/70" />
      {formatMonthDay(date, i18n.language)}（{formatShortWeekday(date, i18n.language)}）·{' '}
      {t('day.noRecord')}
      <div className="h-px flex-1 bg-border/70" />
    </div>
  )
}

function NoteOnlyCard({ day }: { day: Extract<DayEntry, { kind: 'note_only' }> }) {
  const { t } = useTranslation()
  return (
    <article className="bg-card border border-border rounded-lg shadow-card px-5 pt-4 pb-4">
      <DayHeader
        date={day.date}
        place={day.place}
        today={day.today}
        right={
          <span className="font-mono text-[11px] text-muted-foreground/60">
            {t('day.noPhotos')}
          </span>
        }
      />
      <p className="text-[15px] leading-7 mt-2.5">{day.note}</p>
    </article>
  )
}

function PhotosCard({ day }: { day: Extract<DayEntry, { kind: 'photos' }> }) {
  const { t, i18n } = useTranslation()
  const openLightbox = useUi((s) => s.openLightbox)
  const cols = day.photos.length <= 4 ? 'columns-2' : 'columns-3'
  return (
    <article className="bg-card border border-border rounded-lg shadow-card px-5 pt-4 pb-4">
      <DayHeader
        date={day.date}
        place={day.place}
        today={day.today}
        right={
          <span className="font-mono text-[11px] text-muted-foreground">
            {t('unit.photo', { count: day.photos.length })}
          </span>
        }
      />
      <div className={cn(cols, 'gap-2 mt-3')}>
        {day.photos.map((p, i) => (
          <PhotoTile
            key={p.id}
            photo={p}
            onOpen={() => openLightbox(day.photos, i, formatMonthDay(day.date, i18n.language))}
          />
        ))}
      </div>
      <div className="mt-2 pt-3 border-t border-border/60">
        <NoteEditor date={day.date} note={day.note} />
      </div>
    </article>
  )
}
