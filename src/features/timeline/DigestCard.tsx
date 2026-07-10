import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useUi } from '@/app/ui-store'
import type { DayEntry } from '@/domain/models'
import { formatMonthDay } from '@/lib/datetime'
import { formatCount } from '@/lib/format'
import { DayHeader } from './DayHeader'
import { NoteEditor } from './NoteEditor'

type DigestDay = Extract<DayEntry, { kind: 'digest' }>

/** Fold a high-volume day into a fixed-height digest (2a); height is count-independent. */
export function DigestCard({ day }: { day: DigestDay }) {
  const { t, i18n } = useTranslation()
  const openLightbox = useUi((s) => s.openLightbox)
  const navigate = useNavigate()
  const open = (i: number) => openLightbox(day.cover, i, formatMonthDay(day.date, i18n.language))
  const overflow = day.photoCount - day.cover.length

  return (
    <article className="bg-card border border-border rounded-lg shadow-card px-5 pt-4 pb-4">
      <DayHeader
        date={day.date}
        place={day.place}
        today={day.today}
        right={
          <span className="font-mono text-[11px] text-[color:var(--moss)]">
            {t('unit.photo', { count: day.photoCount })}
          </span>
        }
      />

      <div className="grid grid-cols-4 grid-rows-2 gap-1.5 mt-3 h-[300px]">
        <button
          type="button"
          onClick={() => open(0)}
          aria-label={t('photo.open')}
          className="ph rounded-md col-span-2 row-span-2 cursor-zoom-in"
        />
        <button
          type="button"
          onClick={() => open(1)}
          aria-label={t('photo.open')}
          className="ph rounded-md cursor-zoom-in"
        />
        <button
          type="button"
          onClick={() => open(2)}
          aria-label={t('photo.open')}
          className="ph rounded-md cursor-zoom-in"
        />
        <button
          type="button"
          onClick={() => open(3)}
          aria-label={t('photo.open')}
          className="ph rounded-md cursor-zoom-in"
        />
        <button
          type="button"
          onClick={() => navigate('/day')}
          aria-label={t('digest.showAll')}
          className="relative rounded-md overflow-hidden cursor-pointer"
        >
          <span className="ph absolute inset-0" />
          <span className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white">
            <span className="text-[15px] font-semibold">+{formatCount(overflow)}</span>
            <span className="text-[10px] opacity-80 mt-0.5">{t('digest.showAll')}</span>
          </span>
        </button>
      </div>

      <div className="flex gap-1.5 mt-3 overflow-x-auto">
        {day.clusters.map((c) => (
          <button
            key={c.time}
            type="button"
            className="shrink-0 rounded-md bg-secondary text-secondary-foreground px-2 py-1 text-[11px] hover:bg-accent"
          >
            <span className="font-mono text-muted-foreground">{c.time}</span> {c.label}{' '}
            <span className="font-mono text-muted-foreground">{formatCount(c.count)}</span>
          </button>
        ))}
      </div>

      <div className="mt-2 pt-3 border-t border-border/60">
        <NoteEditor date={day.date} note={day.note} />
      </div>
    </article>
  )
}
