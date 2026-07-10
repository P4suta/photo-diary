import { useTranslation } from 'react-i18next'
import { useHeatmap } from '@/app/queries'
import { cn } from '@/lib/cn'
import { heatClass } from './heat'

export function YearHeatmap() {
  const { t, i18n } = useTranslation()
  const { data: weeks } = useHeatmap()
  const months = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(i18n.language, { month: 'short' }).format(new Date(2026, i, 1)),
  )
  const yearLabel = new Intl.DateTimeFormat(i18n.language, { year: 'numeric' }).format(
    new Date(2026, 0, 1),
  )
  return (
    <div className="mt-8 pt-6 border-t border-border">
      <div className="flex items-baseline gap-2">
        <h3 className="text-[13px] font-semibold">{yearLabel}</h3>
        <span className="font-mono text-[11px] text-muted-foreground">
          {t('calendar.yearSummary', { days: 142, count: 3861 })}
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
    </div>
  )
}
