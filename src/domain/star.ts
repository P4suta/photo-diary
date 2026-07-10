/**
 * Pure star-toggle transforms on the domain models. Shared by the mock backend and the
 * app's optimistic cache update so both flip a photo by id the exact same way.
 */
import type { DayEntry, HighlightsData, Photo } from './models'

/** New array with the matching id's `starred` flipped; same reference if the id is absent. */
export function flipStarInPhotos(photos: Photo[], id: string): Photo[] {
  if (!photos.some((p) => p.id === id)) return photos
  return photos.map((p) => (p.id === id ? { ...p, starred: !p.starred } : p))
}

/** Flip a photo's star across every day that can carry photos (photos + digest cover). */
export function flipStarInTimeline(days: DayEntry[], id: string): DayEntry[] {
  return days.map((d) => {
    if (d.kind === 'photos') return { ...d, photos: flipStarInPhotos(d.photos, id) }
    if (d.kind === 'digest') return { ...d, cover: flipStarInPhotos(d.cover, id) }
    return d
  })
}

/** Flip a photo's star across every highlights month. */
export function flipStarInHighlights(data: HighlightsData, id: string): HighlightsData {
  return {
    ...data,
    months: data.months.map((m) => ({ ...m, photos: flipStarInPhotos(m.photos, id) })),
  }
}
