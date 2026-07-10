/**
 * Timeline assembly — a pure layer that builds a one-day-per-card DayEntry[]
 * from raw data (Photo[] + notes). No side effects; depends only on its args.
 *
 * "Today" is always received as an argument (todayIso); it never reads "now".
 * Presentation strings (weekday / month-day) are NOT produced here — the UI
 * formats the raw `date` per locale.
 */

import type { DayEntry, Photo, TimeCluster } from '@/domain/models'

/** A day with more photos than this switches to the digest (chapter) card. */
export const DIGEST_THRESHOLD = 30

/** Cluster-splitting gap threshold (ms): a gap over one hour starts a new chapter. */
const CLUSTER_GAP_MS = 60 * 60 * 1000

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
 * the capture gap exceeds one hour. Each chapter: time = first photo's 'HH:MM',
 * label = the day's place ?? '', count = number of photos.
 */
function buildClusters(sorted: Photo[], place: string | null): TimeCluster[] {
  const label = place ?? ''
  const clusters: TimeCluster[] = []
  let head: Photo | null = null
  let prevMs = 0
  let count = 0

  const flush = () => {
    if (head) clusters.push({ time: hhmmOf(head.takenAt), label, count })
  }

  for (const p of sorted) {
    const ms = new Date(p.takenAt).getTime()
    if (head === null || ms - prevMs > CLUSTER_GAP_MS) {
      flush()
      head = p
      count = 1
    } else {
      count += 1
    }
    prevMs = ms
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
