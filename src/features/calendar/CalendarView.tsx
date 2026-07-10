import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeftIcon, ChevronRightIcon } from '@/ui/icons'
import { Segmented } from '@/ui/Segmented'
import { MonthGrid } from './MonthGrid'
import { YearHeatmap } from './YearHeatmap'

export function CalendarView() {
  const { t, i18n } = useTranslation()
  const [view, setView] = useState<'month' | 'year'>('month')
  // Phase 1: fixed to July 2026.
  const monthLabel = new Intl.DateTimeFormat(i18n.language, {
    year: 'numeric',
    month: 'long',
  }).format(new Date(2026, 6, 1))
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
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent"
              aria-label={t('calendar.nextMonth')}
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
          <button type="button" className="text-[12px] text-muted-foreground hover:text-foreground">
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

        {view === 'month' && <MonthGrid />}
        <YearHeatmap />
      </div>
    </div>
  )
}
