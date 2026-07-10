import { describe, expect, it } from 'vitest'
import type { ImportProgress } from '@/domain/models'
import type { PhotoLibrary } from '@/domain/ports'

/**
 * Implementation-independent contract suite for the PhotoLibrary port — the seam
 * is the center of the testing strategy. Both adapters run it unchanged: the mock
 * (`MockPhotoLibrary.contract.test.ts`) and the real one over a fake IPC transport
 * (`TauriPhotoLibrary.test.ts`). It guards the runtime invariants that `implements`
 * alone cannot.
 *
 * factory() returns a fresh, isolated library each call, so the mutating cases
 * (saveNote/toggleStar/importFolder) can never leak across `it` blocks; the fresh-date
 * case additionally uses a date outside every fixture's range so it cannot collide
 * with the read cases even if an adapter shared state.
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
      const cells = await factory().getMonth(2026, 7)
      expect(cells.length).toBeGreaterThan(0)
      for (const c of cells) {
        expect(c.level).toBeGreaterThanOrEqual(-1)
        expect(c.level).toBeLessThanOrEqual(4)
      }
    })

    it('getMonth: hasNote is a boolean and reflects the per-day records', async () => {
      // July 2026 is the fixture month both adapters populate; it carries notes.
      const cells = await factory().getMonth(2026, 7)
      for (const c of cells) {
        expect(typeof c.hasNote).toBe('boolean')
      }
      // At least one real day must surface hasNote — proving the flag is wired from the
      // records, not hardcoded false. (Save→calendar reflection is intentionally NOT
      // asserted here: the mock's getMonth reads static month records, not saveNote state.)
      expect(cells.some((c) => !c.blank && c.hasNote)).toBe(true)
    })

    it('getHeatmap: 7 days per week, level in -1..4', async () => {
      const weeks = await factory().getHeatmap(2026)
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

    it('saveNote: creates a note_only day on a photoless date, and clearing it removes the day', async () => {
      const lib = factory()
      // A date outside every fixture's range: no photos, no note, no card yet.
      const fresh = '2019-03-14'
      expect((await lib.listTimeline()).some((d) => d.date === fresh)).toBe(false)

      // The core "write a line on a day you took no photos" flow: a note upserts a day.
      await lib.saveNote(fresh, 'a line on an empty day')
      const created = (await lib.listTimeline()).find((d) => d.date === fresh)
      expect(created && 'note' in created ? created.note : null).toBe('a line on an empty day')

      // Clearing the note deletes the row; a photoless day then has nothing left to show.
      await lib.saveNote(fresh, '')
      expect((await lib.listTimeline()).find((d) => d.date === fresh)).toBeUndefined()
    })

    it('importFolder: returns a well-formed result and emits progress', async () => {
      const events: ImportProgress[] = []
      const result = await factory().importFolder('/any/path', (p) => events.push(p))

      expect(typeof result.imported).toBe('number')
      expect(typeof result.skipped).toBe('number')
      expect(typeof result.skippedUnsupported).toBe('number')
      expect(typeof result.bytesSaved).toBe('number')
      expect(Array.isArray(result.failed)).toBe(true)
      expect(Array.isArray(result.scanErrors)).toBe(true)

      // At least one progress tick, each within [1, total].
      expect(events.length).toBeGreaterThan(0)
      for (const e of events) {
        expect(e.current).toBeGreaterThanOrEqual(1)
        expect(e.current).toBeLessThanOrEqual(e.total)
      }
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
