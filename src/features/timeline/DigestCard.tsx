import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUi } from '@/app/ui-store'
import type { DayEntry, Photo } from '@/domain/models'
import { cn } from '@/lib/cn'
import { formatMonthDay } from '@/lib/datetime'
import { formatCount } from '@/lib/format'
import { DayHeader } from './DayHeader'
import { NoteEditor } from './NoteEditor'

type DigestDay = Extract<DayEntry, { kind: 'digest' }>

/** Fold a high-volume day into a fixed-height digest (2a); height is count-independent. */
export function DigestCard({ day }: { day: DigestDay }) {
  const { t, i18n } = useTranslation()
  const openLightbox = useUi((s) => s.openLightbox)
  const coverIds = day.cover.map((p) => p.id)
  const open = (i: number) =>
    openLightbox(coverIds, i, formatMonthDay(day.date, i18n.language), 'timeline')
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
        <CoverTile photo={day.cover[0]} onOpen={() => open(0)} className="col-span-2 row-span-2" />
        <CoverTile photo={day.cover[1]} onOpen={() => open(1)} />
        <CoverTile photo={day.cover[2]} onOpen={() => open(2)} />
        <CoverTile photo={day.cover[3]} onOpen={() => open(3)} />
        {/* The overflow tile shows how many more photos this day holds (real data). It is
            non-interactive until the day-detail screen (2b) exists — no dead action. */}
        <div className="relative rounded-md overflow-hidden">
          <span className="ph absolute inset-0" />
          <span className="absolute inset-0 bg-black/50 flex items-center justify-center text-white">
            <span className="text-[15px] font-semibold">+{formatCount(overflow)}</span>
          </span>
        </div>
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

/**
 * One cover tile. Renders the real thumbnail when the photo carries a `thumbUrl`,
 * falling back to the striped `.ph` placeholder when absent or on load error —
 * the same pattern as PhotoTile. Returns the button directly (no wrapper) so the
 * grid's fixed-height layout is unaffected.
 */
function CoverTile({
  photo,
  onOpen,
  className,
}: {
  photo: Photo | undefined
  onOpen: () => void
  className?: string
}) {
  const { t } = useTranslation()
  const [imgError, setImgError] = useState(false)
  const showImg = !!photo?.thumbUrl && !imgError
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t('photo.open')}
      className={cn('rounded-md overflow-hidden cursor-zoom-in', !showImg && 'ph', className)}
    >
      {showImg && (
        <img
          src={photo.thumbUrl}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      )}
    </button>
  )
}
