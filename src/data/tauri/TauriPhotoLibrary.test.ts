import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImportProgress } from '@/domain/models'
import { runPortContract } from '@/test/port-contract'

/**
 * TauriPhotoLibrary is driven through the SHARED port contract, mocked at the transport
 * boundary (`@tauri-apps/api/core`) rather than at `./commands`. That deliberately keeps
 * the real `commands.ts` in the loop, so this exercises the pieces a `./commands` mock
 * would skip: every command name (`list_photos`, `save_note`, `toggle_star`, …), the
 * `Channel` progress wiring for imports, and `mapPhoto`'s DTO→Photo mapping.
 *
 * The fake is a small stateful in-memory backend returning Rust-shaped (camelCase) DTOs.
 * `reset()` runs per `factory()` call, so each contract test gets an isolated backend.
 */
const t = vi.hoisted(() => {
  interface Row {
    id: string
    place: string | null
    starred: boolean
    taken: string // 'YYYY-MM-DDTHH:MM:SS'
    noThumb?: boolean // emit thumbPath: null (a photo whose thumbnail failed to render)
  }

  const state = {
    photos: [] as Row[],
    notes: new Map<string, string>(),
    invokeCalls: [] as { cmd: string; args: Record<string, unknown> | undefined }[],
  }

  function reset() {
    state.photos = [
      { id: '1', place: 'Yoyogi', starred: false, taken: '2026-07-05T08:00:00' },
      { id: '2', place: 'Yoyogi', starred: true, taken: '2026-07-05T09:30:00' },
      { id: '3', place: null, starred: false, taken: '2026-07-04T14:00:00' },
    ]
    state.notes = new Map<string, string>([['2026-07-05', 'existing note']])
    state.invokeCalls = []
  }
  reset()

  const dayOf = (taken: string) => taken.slice(0, 10)

  // A Rust PhotoDto (serde `rename_all = "camelCase"`).
  function photoDto(r: Row) {
    return {
      id: r.id,
      aspect: '3:2',
      takenAt: r.taken,
      place: r.place,
      starred: r.starred,
      caption: null,
      width: 1920,
      height: 1280,
      megapixels: 2.5,
      thumbPath: r.noThumb ? null : `thumbnails/${r.id}.webp`,
      storePath: `library/${r.id}.avif`,
      sizeBytes: 100,
      format: 'AVIF',
      quality: 'lossless',
      originalFilename: `${r.id}.jpg`,
      importedAt: '2026-07-06T00:00:00',
      lat: null,
      lng: null,
    }
  }

  type ProgressChannel = { onmessage?: (m: ImportProgress) => void }

  const invoke = async (cmd: string, args?: Record<string, unknown>): Promise<unknown> => {
    state.invokeCalls.push({ cmd, args })
    switch (cmd) {
      case 'list_photos':
        return state.photos.map(photoDto)
      case 'list_starred':
        return state.photos.filter((p) => p.starred).map(photoDto)
      case 'list_notes':
        return [...state.notes].map(([date, note]) => ({ date, note }))
      case 'year_counts': {
        const year = Number(args?.year)
        const counts = new Map<string, number>()
        for (const p of state.photos) {
          const d = dayOf(p.taken)
          if (Number(d.slice(0, 4)) === year) counts.set(d, (counts.get(d) ?? 0) + 1)
        }
        return [...counts].map(([date, count]) => ({ date, count }))
      }
      case 'month_records': {
        const prefix = `${Number(args?.year)}-${String(Number(args?.month)).padStart(2, '0')}`
        const byDay = new Map<number, { count: number; hasNote: boolean }>()
        const bump = (day: number, dc: number, note: boolean) => {
          const cur = byDay.get(day) ?? { count: 0, hasNote: false }
          byDay.set(day, { count: cur.count + dc, hasNote: cur.hasNote || note })
        }
        for (const p of state.photos) {
          const d = dayOf(p.taken)
          if (d.startsWith(prefix)) bump(Number(d.slice(8, 10)), 1, false)
        }
        for (const date of state.notes.keys()) {
          if (date.startsWith(prefix)) bump(Number(date.slice(8, 10)), 0, true)
        }
        return [...byDay].map(([day, v]) => ({ day, count: v.count, hasNote: v.hasNote }))
      }
      case 'list_folders':
        return [
          {
            id: '1',
            path: '/photos',
            status: 'watching',
            lastScan: '2026-07-06T00:00:00',
            photoCount: state.photos.length,
          },
        ]
      case 'place_facets':
        return [{ label: 'Yoyogi', count: 2, selected: false, muted: false }]
      case 'get_stats':
        return {
          usedBytes: 1000,
          photoCount: state.photos.length,
          dayCount: 2,
          starredCount: state.photos.filter((p) => p.starred).length,
          thumbnailCacheBytes: 100,
          location: '/library',
          lastImport: '2026-07-06T00:00:00',
        }
      case 'save_note': {
        const date = String(args?.date)
        const note = String(args?.note)
        if (note.trim() === '') state.notes.delete(date)
        else state.notes.set(date, note)
        return undefined
      }
      case 'toggle_star': {
        const id = String(args?.photoId)
        const row = state.photos.find((p) => p.id === id)
        if (row) row.starred = !row.starred
        return row ? row.starred : false
      }
      case 'import_folder': {
        const total = 3
        const channel = args?.onProgress as ProgressChannel | undefined
        for (let current = 1; current <= total; current++) {
          channel?.onmessage?.({ current, total, filename: `IMG_${current}.jpg` })
        }
        return {
          imported: total,
          skipped: 0,
          skippedUnsupported: 0,
          bytesSaved: 0,
          failed: [],
          scanErrors: [],
        }
      }
      default:
        throw new Error(`fake invoke: unexpected command ${cmd}`)
    }
  }

  class Channel<T> {
    onmessage?: (m: T) => void
  }

  const convertFileSrc = (p: string) => `asset://${p}`

  return { state, reset, invoke, Channel, convertFileSrc }
})

vi.mock('@tauri-apps/api/core', () => ({
  invoke: t.invoke,
  Channel: t.Channel,
  convertFileSrc: t.convertFileSrc,
}))

const { TauriPhotoLibrary } = await import('./TauriPhotoLibrary')

// The real adapter, over the fake transport, must satisfy every port invariant the mock does.
runPortContract('TauriPhotoLibrary', () => {
  t.reset()
  return new TauriPhotoLibrary()
})

// toggleStar id validation: same strictness as before, asserted one layer lower — the bad
// id must never reach the transport (no `toggle_star` invoke), the good one must.
describe('TauriPhotoLibrary.toggleStar id validation', () => {
  const lib = new TauriPhotoLibrary()
  beforeEach(() => t.reset())

  const toggledStar = () => t.state.invokeCalls.some((c) => c.cmd === 'toggle_star')

  it('forwards a numeric id to the backend as toggle_star', async () => {
    await lib.toggleStar('1')
    expect(t.state.invokeCalls.some((c) => c.cmd === 'toggle_star' && c.args?.photoId === 1)).toBe(
      true,
    )
  })

  it('throws on an empty id without touching the backend (Number("") === 0 is finite)', async () => {
    await expect(lib.toggleStar('')).rejects.toThrow()
    expect(toggledStar()).toBe(false)
  })

  it('throws on a non-numeric id without touching the backend', async () => {
    await expect(lib.toggleStar('abc')).rejects.toThrow()
    expect(toggledStar()).toBe(false)
  })
})

// mapPhoto's whole reason for existing is DTO paths → asset URLs; the port contract can't
// assert URL fields (they're implementation-specific), so cover the mapping directly here,
// including the null-thumbnail branch the contract's fixtures never hit.
describe('TauriPhotoLibrary mapPhoto path→URL mapping', () => {
  it('converts store/thumb paths to asset URLs and maps a null thumbnail to undefined', async () => {
    t.reset()
    t.state.photos = [
      { id: '1', place: null, starred: false, taken: '2026-07-05T08:00:00' },
      { id: '9', place: null, starred: false, taken: '2026-07-05T09:00:00', noThumb: true },
    ]
    const photos = (await new TauriPhotoLibrary().listTimeline()).flatMap((d) =>
      d.kind === 'photos' ? d.photos : [],
    )
    const withThumb = photos.find((p) => p.id === '1')
    const noThumb = photos.find((p) => p.id === '9')

    expect(withThumb?.fullUrl).toBe('asset://library/1.avif')
    expect(withThumb?.thumbUrl).toBe('asset://thumbnails/1.webp')
    // A null thumbPath becomes undefined (never a broken "asset://null"), while the
    // full-resolution master URL is always present.
    expect(noThumb?.fullUrl).toBe('asset://library/9.avif')
    expect(noThumb?.thumbUrl).toBeUndefined()
  })
})
