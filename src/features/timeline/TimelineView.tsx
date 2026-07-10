import { useTimeline } from '@/app/queries'
import { useTheme } from '@/app/theme'
import { ErrorPanel } from '@/ui/ErrorPanel'
import { DayCard } from './DayCard'

export function TimelineView() {
  const { data: days, isError, refetch } = useTimeline()
  const showEmptyDays = useTheme((s) => s.showEmptyDays)

  return (
    <div className="px-8 py-6">
      <div className="max-w-[640px] mx-auto flex flex-col gap-4">
        {isError ? (
          <ErrorPanel onRetry={() => refetch()} />
        ) : (
          days
            ?.filter((d) => showEmptyDays || d.kind !== 'empty')
            .map((day) => <DayCard key={day.date} day={day} />)
        )}
      </div>
    </div>
  )
}
