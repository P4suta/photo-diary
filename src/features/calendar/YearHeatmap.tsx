import { useTranslation } from 'react-i18next'
import { useHeatmap } from '@/app/queries'
import type { HeatWeek } from '@/domain/heatmap'
import { cn } from '@/lib/cn'
import { ErrorPanel } from '@/ui/ErrorPanel'
import { heatClass } from './heat'

/**
 * ISO date ('YYYY-MM-DD') for the cell at grid position (week wi, weekday di).
 *
 * Mirrors the grid math in `@/domain/build/heatmap` (idx = wi*7 + di - offset, where
 * offset is the weekday of Jan 1): HeatCell carries no date, so the a11y label recovers
 * it from the position. Keep this in sync with buildHeatWeeks if that math ever changes.
 */
function cellIsoDate(year: number, wi: number, di: number, offset: number): string {
  const d = new Date(year, 0, 1 + (wi * 7 + di - offset))
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Recorded-day and total-photo counts derived from the heatmap cells (level >= 0). */
function summarize(weeks: HeatWeek[]): { days: number; count: number } {
  let days = 0
  let count = 0
  for (const week of weeks) {
    for (const cell of week.days) {
      if (cell.count > 0) {
        days += 1
        count += cell.count
      }
    }
  }
  return { days, count }
}

export function YearHeatmap({ year }: { year: number }) {
  const { t, i18n } = useTranslation()
  const { data: weeks, isError, refetch } = useHeatmap(year)
  const months = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(i18n.language, { month: 'short' }).format(new Date(year, i, 1)),
  )
  const yearLabel = new Intl.DateTimeFormat(i18n.language, { year: 'numeric' }).format(
    new Date(year, 0, 1),
  )
  const summary = weeks ? summarize(weeks) : { days: 0, count: 0 }
  // Weekday of Jan 1 — the leading-blank offset used to map grid position back to a date.
  const offset = new Date(year, 0, 1).getDay()
  return (
    <div className="mt-8 pt-6 border-t border-border">
      <div className="flex items-baseline gap-2">
        <h3 className="text-[13px] font-semibold">{yearLabel}</h3>
        <span className="font-mono text-[11px] text-muted-foreground">
          {t('calendar.yearSummary', { days: summary.days, count: summary.count })}
        </span>
        <span className="ml-auto flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
          {t('calendar.less')}
          <span className="w-[11px] h-[11px] rounded-[3px] bg-muted" />
          <span className="w-[11px] h-[11px] rounded-[3px] bg-[color:var(--heat-1)]" />
          <span className="w-[11px] h-[11px] rounded-[3px] bg-[color:var(--heat-2)]" />
          <span className="w-[11px] h-[11px] rounded-[3px] bg-[color:var(--heat-3)]" />
          <span className="w-[11px] h-[11px] rounded-[3px] bg-[color:var(--heat-4)]" />
          {t('calendar.more')}
        </span>
      </div>
      {isError ? (
        <div className="mt-3">
          <ErrorPanel onRetry={() => refetch()} />
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          {/* Recorded days (count>0) are focusable buttons carrying a date+count label,
              so keyboard/AT users can read each day; empty and out-of-range cells stay
              presentational divs so the year isn't 370+ tab stops. A day-detail screen
              (2b) will later give the button an action. */}
          <div className="flex gap-[3px] w-max">
            {weeks?.map((week, wi) => (
              <div key={week.key} className="flex flex-col gap-[3px]">
                {week.days.map((c, di) => {
                  if (c.count > 0) {
                    const label = t('calendar.cellLabel', {
                      date: cellIsoDate(year, wi, di, offset),
                      photos: t('unit.photo', { count: c.count }),
                    })
                    return (
                      <button
                        key={c.key}
                        type="button"
                        aria-label={label}
                        title={label}
                        className={cn(
                          'block w-[15px] h-[15px] rounded-[3px] border-0 p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]',
                          heatClass(c.level),
                        )}
                      />
                    )
                  }
                  return (
                    <div
                      key={c.key}
                      aria-hidden="true"
                      title={c.level >= 0 ? t('unit.photo', { count: c.count }) : ''}
                      className={cn('w-[15px] h-[15px] rounded-[3px]', heatClass(c.level))}
                    />
                  )
                })}
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-12 font-mono text-[9px] text-muted-foreground w-[955px] max-w-full">
            {months.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
