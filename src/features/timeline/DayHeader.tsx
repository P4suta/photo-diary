import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { formatMonthDay, formatWeekday } from '@/lib/datetime'

export function DayHeader({
  date,
  place,
  today,
  right,
}: {
  date: string
  place: string | null
  today: boolean
  right: ReactNode
}) {
  const { t, i18n } = useTranslation()
  return (
    <div className="flex items-baseline gap-2">
      <h3 className="text-[17px] font-semibold">{formatMonthDay(date, i18n.language)}</h3>
      <span className="text-[13px] text-muted-foreground">
        {formatWeekday(date, i18n.language)}
      </span>
      {place && <span className="text-[12px] text-muted-foreground/80">· {place}</span>}
      {today && (
        <span className="text-[11px] font-medium text-[color:var(--moss)]">{t('day.today')}</span>
      )}
      <span className="ml-auto">{right}</span>
    </div>
  )
}
