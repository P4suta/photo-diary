/**
 * Timeline assembly — a pure layer that builds a one-day-per-card DayEntry[]
 * from raw data (Photo[] + notes). No side effects; depends only on its args.
 *
 * "Today" is always received as an argument (todayIso); it never reads "now".
 * Presentation strings (weekday / month-day) are NOT produced here — the UI
 * formats the raw `date` per locale.
 */

import type { DayEntry, EventMetadata, Photo, TimeCluster } from '@/domain/models'

/** A day with more photos than this switches to the digest (chapter) card. */
export const DIGEST_THRESHOLD = 30

/**
 * Largest no-record gap (in days) that is filled with faint 'empty' rows. Longer
 * runs are skipped so a diary with a multi-year hole doesn't emit thousands of rows.
 */
export const EMPTY_GAP_LIMIT = 14

/** Cluster-splitting gap threshold (ms): a gap of 90 minutes starts a new chapter. */
const CLUSTER_GAP_MS = 90 * 60 * 1000

function dateOf(takenAt: string): string {
  return takenAt.slice(0, 10)
}

function hhmmOf(takenAt: string): string {
  return takenAt.slice(11, 16)
}

function firstPlace(photos: Photo[]): string | null {
  for (const p of photos) {
    if (p.place != null) return p.place
  }
  return null
}

/**
 * Split photos sorted by ascending takenAt into chapters (TimeCluster) whenever
 * the capture gap reaches 90 minutes or two known locations differ.
 * Each chapter: time = first photo's 'HH:MM',
 * label = the day's place ?? '', count = number of photos.
 */
export function buildClusters(sorted: Photo[], place: string | null): TimeCluster[] {
  const clusters: TimeCluster[] = []
  let head: Photo | null = null
  let previous: Photo | null = null
  let prevMs = 0
  let count = 0

  const flush = () => {
    if (head) clusters.push({ time: hhmmOf(head.takenAt), label: head.place ?? place ?? '', count })
  }

  for (const p of sorted) {
    const ms = new Date(p.takenAt).getTime()
    // Missing EXIF/location resolution is not itself a move. Only split when both
    // adjacent photos have resolved, different locations.
    const placeChanged = previous?.place != null && p.place != null && p.place !== previous.place
    if (head === null || ms - prevMs >= CLUSTER_GAP_MS || placeChanged) {
      flush()
      head = p
      count = 1
    } else {
      count += 1
    }
    prevMs = ms
    previous = p
  }
  flush()
  return clusters
}

/**
 * Group photos and notes by date and return DayEntry[].
 * - date = group by the first 10 chars of takenAt. notes map date→note.
 * - Sort all dates (photo days ∪ note days) descending.
 * - Has photos: sort ascending; > DIGEST_THRESHOLD → 'digest', else 'photos'.
 * - No photos but a note: 'note_only'.
 */
export function groupTimeline(
  photos: Photo[],
  notes: { date: string; note: string }[],
  todayIso: string,
): DayEntry[] {
  const photosByDate = new Map<string, Photo[]>()
  for (const p of photos) {
    const date = dateOf(p.takenAt)
    const bucket = photosByDate.get(date)
    if (bucket) bucket.push(p)
    else photosByDate.set(date, [p])
  }

  const notesByDate = new Map<string, string>()
  for (const n of notes) notesByDate.set(n.date, n.note)

  const dates = new Set<string>()
  for (const date of photosByDate.keys()) dates.add(date)
  for (const date of notesByDate.keys()) dates.add(date)

  const sortedDates = [...dates].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))

  const entries: DayEntry[] = []
  for (const date of sortedDates) {
    const common = {
      date,
      today: date === todayIso,
    }
    const note = notesByDate.get(date) ?? null
    const dayPhotos = photosByDate.get(date)

    if (dayPhotos && dayPhotos.length > 0) {
      const sorted = [...dayPhotos].sort((a, b) =>
        a.takenAt < b.takenAt ? -1 : a.takenAt > b.takenAt ? 1 : 0,
      )
      const place = firstPlace(sorted)

      if (sorted.length > DIGEST_THRESHOLD) {
        entries.push({
          ...common,
          place,
          kind: 'digest',
          photoCount: sorted.length,
          cover: sorted.slice(0, 4),
          clusters: buildClusters(sorted, place),
          note,
        })
      } else {
        entries.push({ ...common, place, kind: 'photos', photos: sorted, note })
      }
    } else {
      // No photos, has a note (dates = photo days ∪ note days, so a note exists).
      entries.push({ ...common, place: null, kind: 'note_only', note: note ?? '' })
    }
  }

  return entries
}

export interface TimelineDayRecord {
  date: string
  place: string | null
  photoCount: number
  note: string | null
  photos: Photo[]
}

/** Build the timeline from the backend's bounded per-day contract. */
export function buildTimelineFromDays(
  records: TimelineDayRecord[],
  overrides: EventMetadata[],
  todayIso: string,
): DayEntry[] {
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date))
  const consumed = new Set<string>()
  const events = detectEvents(sorted, overrides, todayIso)
  for (const event of events) for (const day of event.days) consumed.add(day.date)

  const entries: DayEntry[] = [...events]
  for (const record of sorted) {
    if (consumed.has(record.date)) continue
    const common = {
      date: record.date,
      place: record.place,
      today: record.date === todayIso,
    }
    const photos = [...record.photos].sort(
      (a, b) => a.takenAt.localeCompare(b.takenAt) || a.id.localeCompare(b.id),
    )
    if (record.photoCount === 0) {
      if (record.note != null) {
        entries.push({ ...common, kind: 'note_only', note: record.note })
      }
    } else if (record.photoCount > DIGEST_THRESHOLD) {
      entries.push({
        ...common,
        kind: 'digest',
        photoCount: record.photoCount,
        cover: photos.slice(0, 4),
        clusters: buildClusters(photos, record.place),
        note: record.note,
      })
    } else {
      entries.push({ ...common, kind: 'photos', photos, note: record.note })
    }
  }
  return withTodayAndGaps(entries, todayIso)
}

function detectEvents(
  records: TimelineDayRecord[],
  overrides: EventMetadata[],
  todayIso: string,
): Extract<DayEntry, { kind: 'event' }>[] {
  const eligible = records
    .filter((record) => record.photoCount >= 200)
    .sort((a, b) => a.date.localeCompare(b.date))
  const runs: TimelineDayRecord[][] = []
  let current: TimelineDayRecord[] = []
  for (const record of eligible) {
    const previous = current.at(-1)
    if (!previous || dayMs(record.date) - dayMs(previous.date) === MS_PER_DAY) {
      current.push(record)
    } else {
      if (current.length >= 2) runs.push(current)
      current = [record]
    }
  }
  if (current.length >= 2) runs.push(current)

  return runs.map((run) => {
    const start = run[0].date
    const end = run[run.length - 1].date
    const exact = overrides.find((item) => item.startDate === start && item.endDate === end)
    const overlapping = overrides.filter((item) => item.startDate <= end && item.endDate >= start)
    const inherited = exact ?? (overlapping.length === 1 ? overlapping[0] : undefined)
    const placeCounts = new Map<string, number>()
    for (const record of run) {
      if (record.place) {
        placeCounts.set(record.place, (placeCounts.get(record.place) ?? 0) + record.photoCount)
      }
    }
    const primaryPlace =
      [...placeCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null
    return {
      kind: 'event',
      date: end,
      place: primaryPlace,
      today: run.some((record) => record.date === todayIso),
      title: inherited?.title ?? primaryPlace ?? `${start} – ${end}`,
      start,
      end,
      photoCount: run.reduce((sum, record) => sum + record.photoCount, 0),
      days: run.map((record) => ({
        date: record.date,
        thumbs: Math.min(4, record.photos.length),
        photoCount: record.photoCount,
        hasNote: record.note != null,
      })),
      note: inherited?.note ?? null,
    }
  })
}

const MS_PER_DAY = 86_400_000

/** 'YYYY-MM-DD' → UTC epoch ms of local-agnostic midnight (deterministic day math). */
function dayMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`)
}

/** UTC epoch ms → 'YYYY-MM-DD'. */
function isoOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** Descending ISO-date comparator (lexicographic works for 'YYYY-MM-DD'). */
function descByDate(a: { date: string }, b: { date: string }): number {
  return b.date.localeCompare(a.date)
}

/**
 * Assemble the timeline the UI consumes: `groupTimeline` plus two guarantees the
 * app's core experience needs (and that raw grouping can't provide):
 *
 * 1. **Today is always present.** Even with no photos and no note, today appears as
 *    an (empty) note_only card so you can always write today's note.
 * 2. **Small no-record gaps are filled** with 'empty' rows (the timeline's faint
 *    "nothing here" dividers). The UI hides them when `showEmptyDays` is off. Gaps
 *    longer than {@link EMPTY_GAP_LIMIT} days are left unfilled.
 *
 * Pure: "today" is the passed `todayIso`; never reads the clock.
 */
export function buildTimeline(
  photos: Photo[],
  notes: { date: string; note: string }[],
  todayIso: string,
): DayEntry[] {
  return withTodayAndGaps(groupTimeline(photos, notes, todayIso), todayIso)
}

function withTodayAndGaps(entries: DayEntry[], todayIso: string): DayEntry[] {
  const byDate = new Map<string, DayEntry>()
  for (const entry of entries) byDate.set(entry.date, entry)
  // 1. Today guarantee — an empty, editable note_only card when nothing was recorded.
  if (!byDate.has(todayIso)) {
    byDate.set(todayIso, {
      date: todayIso,
      place: null,
      today: true,
      kind: 'note_only',
      note: '',
    })
  }

  const recorded = [...byDate.values()].sort(descByDate)

  // 2. Gap-fill between consecutive recorded days (descending).
  const out: DayEntry[] = []
  for (let i = 0; i < recorded.length; i++) {
    const cur = recorded[i]
    out.push(cur)
    const next = recorded[i + 1]
    if (!next) continue
    const missing = Math.round((dayMs(cur.date) - dayMs(next.date)) / MS_PER_DAY) - 1
    if (missing < 1 || missing > EMPTY_GAP_LIMIT) continue
    for (let d = 1; d <= missing; d++) {
      const date = isoOf(dayMs(cur.date) - d * MS_PER_DAY)
      out.push({ date, place: null, today: date === todayIso, kind: 'empty' })
    }
  }

  return out
}
