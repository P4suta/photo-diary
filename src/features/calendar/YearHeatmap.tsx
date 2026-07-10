import { useTranslation } from 'react-i18next'
import { useHeatmap } from '@/app/queries'
import type { HeatWeek } from '@/domain/heatmap'
import { cn } from '@/lib/cn'
import { ErrorPanel } from '@/ui/ErrorPanel'
import { heatClass } from './heat'

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
          <div className="flex gap-[3px] w-max">
            {weeks?.map((week) => (
              <div key={week.key} className="flex flex-col gap-[3px]">
                {week.days.map((c) => (
                  <div
                    key={c.key}
                    title={c.level >= 0 ? t('unit.photo', { count: c.count }) : ''}
                    className={cn('w-[15px] h-[15px] rounded-[3px]', heatClass(c.level))}
                  />
                ))}
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
