import { useTranslation } from 'react-i18next'
import { useHighlights } from '@/app/queries'
import { useUi } from '@/app/ui-store'
import { formatMonthLabel } from '@/lib/datetime'
import { ErrorPanel } from '@/ui/ErrorPanel'
import { PhotoTile } from '@/ui/PhotoTile'

/** Starred highlights (3c): only self-picked photos, grouped by month. No recommendations. */
export function HighlightsView() {
  const { t, i18n } = useTranslation()
  const { data, isError, refetch } = useHighlights()
  const openLightbox = useUi((s) => s.openLightbox)

  if (isError) {
    return (
      <div className="px-8 py-6">
        <ErrorPanel onRetry={() => refetch()} />
      </div>
    )
  }
  if (!data) return null

  return (
    <div className="px-8 py-6">
      <div className="flex items-baseline gap-2">
        <h2 className="text-[20px] font-semibold">{t('highlights.title')}</h2>
        <span className="font-mono text-[11px] text-muted-foreground">
          {t('highlights.subtitle', { count: data.total })}
        </span>
      </div>

      {data.months.map((m) => {
        const label = formatMonthLabel(m.yearMonth, i18n.language)
        const photoIds = m.photos.map((p) => p.id)
        return (
          <section key={m.yearMonth} className="mt-5">
            <div className="flex items-baseline gap-2">
              <h3 className="text-[13px] font-semibold">{label}</h3>
              <span className="font-mono text-[10px] text-muted-foreground">
                {t('unit.photo', { count: m.count })}
              </span>
            </div>
            <div className="columns-4 gap-2 mt-2">
              {m.photos.map((p, i) => (
                <PhotoTile
                  key={p.id}
                  photo={p}
                  size="grid"
                  onOpen={() => openLightbox(photoIds, i, label, 'highlights')}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
