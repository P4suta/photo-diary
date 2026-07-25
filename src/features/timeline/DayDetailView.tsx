import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useDayPhotos, useDaySummary, useSetStarred } from '@/app/queries'
import { useUi } from '@/app/ui-store'
import type { Photo } from '@/domain/models'
import { formatMonthDay, formatShortWeekday } from '@/lib/datetime'
import { Button } from '@/ui/Button'
import { ErrorPanel } from '@/ui/ErrorPanel'
import { ChevronLeftIcon } from '@/ui/icons'

type TileSize = 'large' | 'medium' | 'small'

const LAYOUT: Record<TileSize, { columns: number; rowHeight: number }> = {
  large: { columns: 4, rowHeight: 176 },
  medium: { columns: 8, rowHeight: 104 },
  small: { columns: 12, rowHeight: 76 },
}

export function DayDetailView() {
  const { date = '' } = useParams()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [size, setSize] = useState<TileSize>('medium')
  const [starredOnly, setStarredOnly] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(600)
  const [scrubTarget, setScrubTarget] = useState<number | null>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const summary = useDaySummary(date)
  const pages = useDayPhotos(date, starredOnly)
  const setStarred = useSetStarred()
  const openLightbox = useUi((state) => state.openLightbox)
  const photos = pages.data?.pages.flatMap((page) => page.photos) ?? []
  const layout = LAYOUT[size]
  const rows = Math.ceil(photos.length / layout.columns)
  const totalHeight = rows * layout.rowHeight
  const firstRow = Math.max(0, Math.floor(scrollTop / layout.rowHeight) - 2)
  const visibleRows = Math.ceil(viewportHeight / layout.rowHeight) + 4
  const lastRow = Math.min(rows, firstRow + visibleRows)
  const visiblePhotos = photos.slice(firstRow * layout.columns, lastRow * layout.columns)
  const clusters = summary.data?.clusters ?? []

  useEffect(() => {
    if (scrubTarget === null || pages.isFetchingNextPage) return
    const last = photos.at(-1)
    const lastMinutes = last
      ? Number(last.takenAt.slice(11, 13)) * 60 + Number(last.takenAt.slice(14, 16))
      : -1
    if (pages.hasNextPage && lastMinutes < scrubTarget) {
      void pages.fetchNextPage()
      return
    }
    const index = photos.findIndex((photo) => {
      const [hour, minute] = photo.takenAt.slice(11, 16).split(':').map(Number)
      return hour * 60 + minute >= scrubTarget
    })
    const target = index < 0 ? photos.length - 1 : index
    const top = Math.floor(Math.max(0, target) / layout.columns) * layout.rowHeight
    requestAnimationFrame(() => scroll.current?.scrollTo({ top, behavior: 'smooth' }))
    setScrubTarget(null)
  }, [
    layout.columns,
    layout.rowHeight,
    pages.fetchNextPage,
    pages.hasNextPage,
    pages.isFetchingNextPage,
    photos,
    scrubTarget,
  ])

  if (summary.isError || pages.isError) {
    return <ErrorPanel onRetry={() => void Promise.all([summary.refetch(), pages.refetch()])} />
  }

  return (
    <div className="h-full overflow-hidden bg-background text-foreground flex flex-col">
      <header className="h-[56px] shrink-0 border-b border-border flex items-center gap-3 px-5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label={t('dayDetail.back')}
          className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="text-[15px] font-semibold">
            {formatMonthDay(date, i18n.language)} ({formatShortWeekday(date, i18n.language)})
          </h2>
          <span className="text-[12px] text-muted-foreground truncate">
            {summary.data?.place ?? t('lightbox.noPlace')}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {t('unit.photo', { count: summary.data?.photoCount ?? 0 })}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            aria-pressed={starredOnly}
            onClick={() => setStarredOnly((value) => !value)}
            className="h-7 rounded-md border border-input px-2 text-[11px] hover:bg-accent"
          >
            {t('dayDetail.picksOnly')}
          </button>
          <div className="flex rounded-md border border-input overflow-hidden">
            {(['large', 'medium', 'small'] as const).map((value) => (
              <button
                type="button"
                key={value}
                title={t(`dayDetail.size.${value}`)}
                aria-pressed={size === value}
                onClick={() => setSize(value)}
                className={`w-8 h-7 text-[10px] ${
                  size === value ? 'bg-secondary text-secondary-foreground' : 'hover:bg-accent'
                }`}
              >
                {value === 'large' ? '▣' : value === 'medium' ? '▪' : '·'}
              </button>
            ))}
          </div>
          <Button
            variant={selecting ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => {
              setSelecting((value) => !value)
              setSelected(new Set())
            }}
          >
            {t(selecting ? 'dayDetail.doneSelecting' : 'dayDetail.select')}
          </Button>
        </div>
      </header>

      {selecting && selected.size > 0 && (
        <div className="shrink-0 border-b border-border bg-card px-5 py-2 flex items-center gap-2">
          <span className="text-[12px]">{t('dayDetail.selected', { count: selected.size })}</span>
          <Button
            size="sm"
            onClick={() => setStarred.mutate({ photoIds: [...selected], starred: true })}
          >
            {t('dayDetail.starSelected')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStarred.mutate({ photoIds: [...selected], starred: false })}
          >
            {t('dayDetail.unstarSelected')}
          </Button>
        </div>
      )}

      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 flex flex-col">
          {clusters.length > 0 && (
            <div className="shrink-0 px-5 py-2 border-b border-border flex gap-1.5 overflow-x-auto">
              {clusters.map((cluster) => (
                <button
                  type="button"
                  key={`${cluster.time}-${cluster.label}`}
                  data-testid="day-cluster"
                  data-cluster-time={cluster.time}
                  className="shrink-0 rounded bg-secondary px-2 py-1 text-[10px]"
                  onClick={() => {
                    const [hour, minute] = cluster.time.split(':').map(Number)
                    setScrubTarget(hour * 60 + minute)
                  }}
                >
                  <span className="font-mono">{cluster.time}</span> {cluster.label}{' '}
                  <span className="text-muted-foreground">{cluster.count}</span>
                </button>
              ))}
            </div>
          )}
          <div
            ref={scroll}
            data-testid="virtual-day-grid"
            data-loaded-count={photos.length}
            className="flex-1 min-h-0 overflow-y-auto"
            onScroll={(event) => {
              const element = event.currentTarget
              setScrollTop(element.scrollTop)
              setViewportHeight(element.clientHeight)
              if (
                element.scrollTop + element.clientHeight >= element.scrollHeight - 400 &&
                pages.hasNextPage &&
                !pages.isFetchingNextPage
              ) {
                void pages.fetchNextPage()
              }
            }}
          >
            <div className="relative px-3" style={{ height: totalHeight }}>
              <div
                className="absolute left-3 right-3 grid gap-1.5"
                style={{
                  top: firstRow * layout.rowHeight,
                  gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
                }}
              >
                {visiblePhotos.map((photo) => (
                  <VirtualPhoto
                    key={photo.id}
                    photo={photo}
                    selected={selected.has(photo.id)}
                    selecting={selecting}
                    height={layout.rowHeight - 6}
                    onOpen={() => {
                      if (selecting) {
                        setSelected((current) => {
                          const next = new Set(current)
                          if (next.has(photo.id)) next.delete(photo.id)
                          else next.add(photo.id)
                          return next
                        })
                      } else {
                        const index = photos.findIndex((item) => item.id === photo.id)
                        openLightbox(
                          photos.map((item) => item.id),
                          index,
                          formatMonthDay(date, i18n.language),
                          'day',
                          date,
                        )
                      }
                    }}
                  />
                ))}
              </div>
            </div>
            {pages.isFetchingNextPage && (
              <div className="p-3 text-center text-[11px] text-muted-foreground">
                {t('dayDetail.loading')}
              </div>
            )}
          </div>
        </div>

        <label className="w-[64px] shrink-0 border-l border-border flex flex-col items-center py-4">
          <span className="font-mono text-[9px] text-muted-foreground">00</span>
          <input
            aria-label={t('dayDetail.scrubber')}
            type="range"
            min={0}
            max={1439}
            defaultValue={720}
            onChange={(event) => setScrubTarget(Number(event.target.value))}
            className="flex-1 my-2"
            style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
          />
          <span className="font-mono text-[9px] text-muted-foreground">23</span>
        </label>
      </div>
    </div>
  )
}

function VirtualPhoto({
  photo,
  selected,
  selecting,
  height,
  onOpen,
}: {
  photo: Photo
  selected: boolean
  selecting: boolean
  height: number
  onOpen: () => void
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      aria-label={t(selecting ? 'dayDetail.toggleSelection' : 'photo.open')}
      aria-pressed={selecting ? selected : undefined}
      onClick={onOpen}
      className={`relative rounded-md overflow-hidden bg-muted ${
        selected ? 'ring-2 ring-[color:var(--moss)]' : ''
      }`}
      style={{ height }}
    >
      {photo.thumbUrl ? (
        <img src={photo.thumbUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
      ) : (
        <span className="ph absolute inset-0" />
      )}
      {photo.starred && (
        <span className="absolute top-1 left-1 rounded bg-[color:var(--moss)] px-1 text-white text-[9px]">
          ★
        </span>
      )}
      {selected && <span className="absolute inset-0 bg-white/20" />}
    </button>
  )
}
