/**
 * Locale-aware date/time formatting via Intl. Callers pass the active locale
 * (from i18next's `i18n.language`). This is the UI-layer home for presentation
 * that used to be baked into the domain (weekday/month-day strings).
 */

/** Parse 'YYYY-MM-DD' as a *local* midnight Date (timezone-safe for the day part). */
function localDate(date: string): Date {
  return new Date(`${date.slice(0, 10)}T00:00:00`)
}

/** Today's local parts (1-based month), for seeding date-dependent UI state. */
export function todayParts(): { year: number; month: number; day: number } {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() }
}

/** localized 'year month' label, e.g. 'July 2026' / '2026年7月'. */
export function formatYearMonth(year: number, month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(
    new Date(year, month - 1, 1),
  )
}

/** 'YYYY-MM-DD' → e.g. 'July 5' (en) / '7月5日' (ja) */
export function formatMonthDay(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric' }).format(localDate(date))
}

/** 'YYYY-MM-DD' → 'Sunday' / '日曜日' */
export function formatWeekday(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(localDate(date))
}

/** 'YYYY-MM-DD' → 'Sun' / '日' (compact weekday) */
export function formatShortWeekday(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(localDate(date))
}

/** 'YYYY-MM-DD' → 'Jul 5' / '7/5' (compact day label, e.g. event rows) */
export function formatDayLabel(date: string, locale: string): string {
  const d = localDate(date)
  const md = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(d)
  const wd = formatShortWeekday(date, locale)
  return `${md} ${wd}`
}

/** Inclusive date range → 'Jun 24 – Jun 27, 2026' style, per locale. */
export function formatDateRange(start: string, end: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
  }).formatRange(localDate(start), localDate(end))
}

/** ISO timestamp → full 'taken at' string, per locale. */
export function formatTakenAt(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

/** ISO timestamp → compact 'imported at' string, per locale. */
export function formatImportedAt(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

/** 'YYYY-MM' → localized month label, e.g. 'July' / '7月' (highlights). */
export function formatMonthLabel(yearMonth: string, locale: string): string {
  const [year, month] = yearMonth.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(year, month - 1, 1))
}
