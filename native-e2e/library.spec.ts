import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { sep } from 'node:path'
import { browser, expect } from '@wdio/globals'
import '@wdio/tauri-service'
import { nativeExportPath, nativeFixtureDir, nativeScreenshotDir, nativeStatePath } from './paths'

interface PhotoDto {
  id: string
  takenAt: string
  place: string | null
  starred: boolean
  caption: string | null
  storePath: string
  thumbPath: string | null
}

interface TimelineDayDto {
  date: string
  photoCount: number
  photos: PhotoDto[]
}

interface DayPage {
  photos: PhotoDto[]
  nextCursor: string | null
}

interface StatsDto {
  photoCount: number
}

interface ImportDto {
  imported: number
  skipped: number
  skippedUnsupported: number
  failed: unknown[]
  scanErrors: unknown[]
}

interface NativeAcceptanceSeed {
  eventStart: string
  eventEnd: string
  largeDate: string
  inserted: number
}

interface DaySummaryDto {
  photoCount: number
  clusters: { time: string; label: string; count: number }[]
}

async function invoke<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  return browser.tauri.execute((tauri, input) => tauri.core.invoke(input.command, input.args), {
    command,
    args,
  }) as Promise<T>
}

describe('photo-diary native backend', () => {
  it('uses real SQLite/IPC for import, watching, persistence, export, cache and removal', async () => {
    expect(await browser.tauri.listWindows()).toContain('main')

    await browser.execute(() => {
      localStorage.setItem('photo-diary-locale', 'en')
      localStorage.setItem('photo-diary-theme', 'light')
    })
    await browser.refresh()
    await (await browser.$('h2=A diary that begins from photos')).waitForExist()
    await (await browser.$('[data-drop-ready="true"]')).waitForExist()

    // Use Tauri's documented IPC bridge for native acceptance. The onboarding listener's
    // registration contract is covered by the frontend suite; WDIO validates the real command,
    // progress Channel, SQLite writes and subsequent UI reads without synthesizing OS events.
    const imported = (await browser.execute(async (path) => {
      const core = (
        globalThis as unknown as {
          __TAURI__: {
            core: {
              Channel: new () => unknown
              invoke: (command: string, args: Record<string, unknown>) => Promise<unknown>
            }
          }
        }
      ).__TAURI__.core
      const onProgress = new core.Channel()
      return core.invoke('import_folder', { path, onProgress })
    }, nativeFixtureDir)) as unknown as ImportDto
    expect(imported.imported).toBe(1)
    expect(imported.failed).toHaveLength(1)
    expect(imported.scanErrors).toHaveLength(0)
    expect(imported.skippedUnsupported).toBe(1)

    const days = await invoke<TimelineDayDto[]>('list_timeline', { filter: null })
    expect(days).toHaveLength(1)
    expect(days[0].photoCount).toBe(1)
    const date = days[0].date
    const photo = days[0].photos[0]
    const photoId = Number(photo.id)

    await invoke('save_caption', { photoId, caption: 'native caption' })
    await invoke('set_starred', { photoIds: [photoId], starred: true })

    await invoke('set_import_paused', { paused: true })
    expect((await invoke<{ paused: boolean }>('get_job_state')).paused).toBe(true)
    await invoke('set_import_paused', { paused: false })

    const noLocation = await invoke<TimelineDayDto[]>('list_timeline', {
      filter: { startDate: date, endDate: date, places: [null] },
    })
    expect(noLocation[0].date).toBe(date)

    copyFileSync('src-tauri/icons/32x32.png', `${nativeFixtureDir}${sep}IMG_0002.png`)
    await browser.waitUntil(async () => (await invoke<StatsDto>('get_stats')).photoCount === 2, {
      timeout: 30_000,
      interval: 1_000,
      timeoutMsg: 'live watcher did not import IMG_0002.png',
    })

    const cleared = await invoke<number>('clear_thumbnail_cache')
    expect(cleared).toBeGreaterThanOrEqual(2)
    const regenerated = await invoke<{ regenerated: number; failed: unknown[] }>(
      'regenerate_thumbnail_cache',
    )
    expect(regenerated.regenerated).toBe(2)
    expect(regenerated.failed).toHaveLength(0)

    const pageBeforeRestart = await invoke<DayPage>('get_day_photos', {
      date,
      cursor: null,
      limit: 120,
      starredOnly: false,
    })
    const edited = pageBeforeRestart.photos.find((item) => item.id === photo.id)
    expect(edited?.caption).toBe('native caption')
    expect(edited?.starred).toBe(true)

    await invoke('export_photo', { photoId, destination: nativeExportPath })
    expect(readFileSync(nativeExportPath)).toEqual(readFileSync(photo.storePath))

    const seed = await invoke<NativeAcceptanceSeed>('seed_native_acceptance_data')
    expect(seed.inserted).toBe(640)
    const eventDays = await invoke<TimelineDayDto[]>('list_timeline', {
      filter: { startDate: seed.eventStart, endDate: seed.eventEnd, places: [] },
    })
    expect(eventDays).toHaveLength(2)
    expect(eventDays.every((day) => day.photoCount >= 200)).toBe(true)

    const largeSummary = await invoke<DaySummaryDto>('get_day_summary', {
      date: seed.largeDate,
    })
    expect(largeSummary.photoCount).toBe(240)
    expect(largeSummary.clusters).toEqual([
      { time: '08:00', label: 'Kyoto, JP', count: 120 },
      { time: '14:00', label: 'Osaka, JP', count: 120 },
    ])
    const largeFirst = await invoke<DayPage>('get_day_photos', {
      date: seed.largeDate,
      cursor: null,
      limit: 120,
      starredOnly: false,
    })
    expect(largeFirst.photos).toHaveLength(120)
    expect(largeFirst.nextCursor).not.toBeNull()
    const largeSecond = await invoke<DayPage>('get_day_photos', {
      date: seed.largeDate,
      cursor: largeFirst.nextCursor,
      limit: 120,
      starredOnly: false,
    })
    expect(largeSecond.photos).toHaveLength(120)
    expect(largeSecond.nextCursor).toBeNull()

    await browser.execute(() => {
      localStorage.setItem('photo-diary-locale', 'en')
      localStorage.setItem('photo-diary-theme', 'light')
    })
    await browser.refresh()
    await browser.waitUntil(async () => (await browser.getTitle()) === 'photo-diary — 写真日記', {
      timeoutMsg: 'renderer did not recover after reload',
    })

    const welcomeLink = await browser.$('a[href="/"]')
    if (await welcomeLink.isExisting()) {
      await welcomeLink.click()
    }
    const eventTitle = await browser.$('input[aria-label="Event title"]')
    await eventTitle.waitForExist()
    expect(await eventTitle.getValue()).toBe('Kyoto, JP')
    await eventTitle.setValue('Native multi-night event')
    await browser.execute(() => {
      const active = (
        globalThis as unknown as {
          document: { activeElement: { blur?: () => void } | null }
        }
      ).document.activeElement
      active?.blur?.()
    })
    const eventNote = await browser.$('textarea[aria-label="Event note"]')
    await eventNote.setValue('Persists across a real app restart')
    await browser.execute(() => {
      const active = (
        globalThis as unknown as {
          document: { activeElement: { blur?: () => void } | null }
        }
      ).document.activeElement
      active?.blur?.()
    })
    await browser.waitUntil(async () => {
      const overrides =
        await invoke<{ title: string; note: string | null }[]>('list_event_overrides')
      return overrides.some(
        (item) =>
          item.title === 'Native multi-night event' &&
          item.note === 'Persists across a real app restart',
      )
    })

    const openLargeDay = await browser.$('button[aria-label="Open day detail"]')
    await openLargeDay.waitForExist()
    await openLargeDay.click()
    await browser.waitUntil(async () => (await browser.getUrl()).endsWith(`/day/${seed.largeDate}`))
    const clusterChips = await browser.$$('[data-testid="day-cluster"]')
    expect(clusterChips).toHaveLength(2)
    const grid = await browser.$('[data-testid="virtual-day-grid"]')
    await grid.waitForExist()
    expect(await grid.getAttribute('data-loaded-count')).toBe('120')
    await browser.execute((element) => {
      element.scrollTop = element.scrollHeight
      element.dispatchEvent(new Event('scroll'))
    }, grid)
    await browser.waitUntil(async () => (await grid.getAttribute('data-loaded-count')) === '240')

    const settingsLink = await browser.$('a[href="/settings"]')
    await settingsLink.waitForExist()
    await settingsLink.click()
    await (await browser.$('h2=Settings')).waitForExist()
    await browser.execute(() => {
      const main = (
        globalThis as unknown as {
          document: { querySelector: (selector: string) => { scrollTop: number } | null }
        }
      ).document.querySelector('main')
      if (main) main.scrollTop = 0
    })
    await browser.waitUntil(
      () =>
        browser.execute(() => {
          const main = (
            globalThis as unknown as {
              document: { querySelector: (selector: string) => { scrollTop: number } | null }
            }
          ).document.querySelector('main')
          return main?.scrollTop === 0
        }),
      { timeoutMsg: 'settings scroll container did not return to the top' },
    )
    await browser.setWindowSize(1180, 820)
    await (await browser.$('button=Light')).click()
    await browser.saveScreenshot(`${nativeScreenshotDir}${sep}en-light-1180x820.png`)
    await (await browser.$('button=Dark')).click()
    await browser.saveScreenshot(`${nativeScreenshotDir}${sep}en-dark-1180x820.png`)
    await (await browser.$('button=日本語')).click()
    await (await browser.$('button=ライト')).click()
    await browser.saveScreenshot(`${nativeScreenshotDir}${sep}ja-light-1180x820.png`)
    await browser.setWindowSize(900, 600)
    await (await browser.$('button=ダーク')).click()
    await browser.saveScreenshot(`${nativeScreenshotDir}${sep}ja-dark-900x600.png`)

    const folders = await invoke<{ id: string }[]>('list_folders')
    expect(folders).toHaveLength(1)
    expect((await invoke<StatsDto>('get_stats')).photoCount).toBe(642)
    writeFileSync(
      nativeStatePath,
      JSON.stringify({
        date,
        photoId,
        storePath: photo.storePath,
        eventStart: seed.eventStart,
        eventEnd: seed.eventEnd,
        largeDate: seed.largeDate,
        expectedPhotoCount: 642,
      }),
    )
  })
})
