import { describe, expect, it } from 'vitest'
import type { PhotoLibrary } from '@/domain/ports'

/**
 * Implementation-independent contract suite for the PhotoLibrary port — the seam
 * is the center of the testing strategy. Phase 2's TauriPhotoLibrary can reuse this
 * suite unchanged (it guards the runtime invariants that `implements` alone cannot).
 *
 * factory() is called each time, but the mock shares module-singleton fixtures, so
 * the mutating tests (saveNote/toggleStar) restore what they change.
 */
export function runPortContract(name: string, factory: () => PhotoLibrary): void {
  describe(`PhotoLibrary contract: ${name}`, () => {
    it('listTimeline: dates descending, first entry is today', async () => {
      const days = await factory().listTimeline()
      expect(days.length).toBeGreaterThan(0)
      const dates = days.map((d) => d.date)
      const descending = [...dates].sort((a, b) => (a < b ? 1 : -1))
      expect(dates).toEqual(descending)
      expect(days[0].today).toBe(true)
    })

    it('listTimeline: digest has cover.length<=4 and photoCount>=cover.length', async () => {
      const days = await factory().listTimeline()
      for (const d of days) {
        if (d.kind === 'digest') {
          expect(d.cover.length).toBeLessThanOrEqual(4)
          expect(d.photoCount).toBeGreaterThanOrEqual(d.cover.length)
        }
      }
    })

    it('getMonth: non-empty cells, level in -1..4', async () => {
      const cells = await factory().getMonth()
      expect(cells.length).toBeGreaterThan(0)
      for (const c of cells) {
        expect(c.level).toBeGreaterThanOrEqual(-1)
        expect(c.level).toBeLessThanOrEqual(4)
      }
    })

    it('getHeatmap: 7 days per week, level in -1..4', async () => {
      const weeks = await factory().getHeatmap()
      expect(weeks.length).toBeGreaterThan(0)
      for (const w of weeks) {
        expect(w.days).toHaveLength(7)
        for (const c of w.days) {
          expect(c.level).toBeGreaterThanOrEqual(-1)
          expect(c.level).toBeLessThanOrEqual(4)
        }
      }
    })

    it('getStats: required fields are present', async () => {
      const s = await factory().getStats()
      expect(s.photoCount).toBeGreaterThanOrEqual(0)
      expect(s.usedBytes).toBeGreaterThanOrEqual(0)
      expect(typeof s.location).toBe('string')
    })

    it('getHighlights / listFolders / listPlaceFacets: return the expected shapes', async () => {
      const lib = factory()
      const h = await lib.getHighlights()
      expect(Array.isArray(h.months)).toBe(true)
      expect(Array.isArray(await lib.listFolders())).toBe(true)
      expect(Array.isArray(await lib.listPlaceFacets())).toBe(true)
    })

    it('saveNote: the note is reflected on that day after saving', async () => {
      const lib = factory()
      const before = await lib.listTimeline()
      // Pick a day that has a note (prefer non-null so we can restore it).
      const target = before.find((d) => 'note' in d && d.note != null)
      if (!target || !('note' in target)) throw new Error('no day with a note')
      const original = target.note as string
      await lib.saveNote(target.date, 'contract test note')
      const updated = (await lib.listTimeline()).find((d) => d.date === target.date)
      expect(updated && 'note' in updated ? updated.note : null).toBe('contract test note')
      await lib.saveNote(target.date, original) // restore
    })

    it('toggleStar: two toggles return to the original (idempotent flip)', async () => {
      const lib = factory()
      const days = await lib.listTimeline()
      const photosDay = days.find((d) => d.kind === 'photos')
      if (photosDay?.kind !== 'photos') throw new Error('no photos day')
      const id = photosDay.photos[0].id
      const starOf = async (): Promise<boolean | undefined> => {
        const d = (await lib.listTimeline()).find((x) => x.date === photosDay.date)
        return d?.kind === 'photos' ? d.photos[0].starred : undefined
      }
      const initial = await starOf()
      await lib.toggleStar(id)
      expect(await starOf()).toBe(!initial)
      await lib.toggleStar(id)
      expect(await starOf()).toBe(initial)
    })
  })
}
