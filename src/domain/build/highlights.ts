/**
 * Group starred photos by year-month, newest month first. Pure and deterministic
 * (no "now"): raw 'YYYY-MM' + count come out, and the UI formats the labels.
 */

import type { HighlightMonth, HighlightsData, Photo } from '@/domain/models'

function yearMonthKey(takenAt: string): string {
  return takenAt.slice(0, 7)
}

export function groupHighlights(photos: Photo[], libraryTotal: number): HighlightsData {
  const groups = new Map<string, Photo[]>()
  for (const photo of photos) {
    const key = yearMonthKey(photo.takenAt)
    const bucket = groups.get(key)
    if (bucket) {
      bucket.push(photo)
    } else {
      groups.set(key, [photo])
    }
  }

  const months: HighlightMonth[] = [...groups.keys()]
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .map((key) => {
      const monthPhotos = groups.get(key) ?? []
      return { yearMonth: key, count: monthPhotos.length, photos: monthPhotos }
    })

  return { total: photos.length, libraryTotal, months }
}
