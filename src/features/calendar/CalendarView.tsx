import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatYearMonth, todayParts } from '@/lib/datetime'
import { ChevronLeftIcon, ChevronRightIcon } from '@/ui/icons'
import { Segmented } from '@/ui/Segmented'
import { MonthGrid } from './MonthGrid'
import { YearHeatmap } from './YearHeatmap'

/** Step a {year, month} (1-based) by whole months. */
function stepMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const zero = year * 12 + (month - 1) + delta
  return { year: Math.floor(zero / 12), month: (zero % 12) + 1 }
}

export function CalendarView() {
  const { t, i18n } = useTranslation()
  const [view, setView] = useState<'month' | 'year'>('month')
  const [{ year, month }, setYm] = useState(() => {
    const t0 = todayParts()
    return { year: t0.year, month: t0.month }
  })

  const monthLabel = formatYearMonth(year, month, i18n.language)
  const goToday = () => {
    const t0 = todayParts()
    setYm({ year: t0.year, month: t0.month })
  }

  return (
    <div className="p-8">
      <div className="max-w-[1040px]">
        <div className="flex items-center gap-3">
          <h2 className="text-[20px] font-semibold">{monthLabel}</h2>
          <div className="flex items-center">
            <button
              type="button"
              className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent"
              aria-label={t('calendar.prevMonth')}
              onClick={() => setYm(stepMonth(year, month, -1))}
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent"
              aria-label={t('calendar.nextMonth')}
              onClick={() => setYm(stepMonth(year, month, 1))}
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
          <button
            type="button"
            className="text-[12px] text-muted-foreground hover:text-foreground"
            onClick={goToday}
          >
            {t('calendar.today')}
          </button>
          <div className="ml-auto">
            <Segmented
              options={[
                { value: 'month', label: t('calendar.month') },
                { value: 'year', label: t('calendar.year') },
              ]}
              value={view}
              onChange={setView}
            />
          </div>
        </div>

        {view === 'month' && <MonthGrid year={year} month={month} />}
        <YearHeatmap year={year} />
      </div>
    </div>
  )
}
