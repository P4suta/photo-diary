import { useEffect, useState } from 'react'

/** Current local date as 'YYYY-MM-DD'. */
function currentIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = `${now.getMonth() + 1}`.padStart(2, '0')
  const d = `${now.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Today's date ('YYYY-MM-DD'), re-rendering when the day rolls over. Used in
 * date-dependent query keys so a diary left open overnight refetches "today"
 * instead of staying on yesterday (queries use staleTime: Infinity).
 *
 * Detection: a coarse interval (the app is long-lived and idle-tolerant) plus
 * visibility/focus changes, which catch a machine waking from sleep immediately.
 */
export function useToday(): string {
  const [today, setToday] = useState(currentIso)

  useEffect(() => {
    const tick = () => setToday((prev) => (prev === currentIso() ? prev : currentIso()))
    const id = window.setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('focus', tick)
    }
  }, [])

  return today
}
