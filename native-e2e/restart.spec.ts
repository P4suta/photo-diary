import { existsSync, readFileSync } from 'node:fs'
import { browser, expect } from '@wdio/globals'
import '@wdio/tauri-service'
import { nativeStatePath } from './paths'

interface RestartState {
  date: string
  photoId: number
  storePath: string
  eventStart: string
  eventEnd: string
  largeDate: string
  expectedPhotoCount: number
}

interface PhotoDto {
  id: string
  starred: boolean
  caption: string | null
}

interface DayPage {
  photos: PhotoDto[]
  nextCursor: string | null
}

interface EventOverrideDto {
  id: string
  startDate: string
  endDate: string
  title: string
  note: string | null
}

interface StatsDto {
  photoCount: number
}

interface FolderDto {
  id: string
}

async function invoke<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  return browser.tauri.execute((tauri, input) => tauri.core.invoke(input.command, input.args), {
    command,
    args,
  }) as Promise<T>
}

/**
 * Steps the calendar from the month it opens on to the month holding `date` ('YYYY-MM-DD').
 * The calendar opens on the real current month, while the seeded photos carry fixed dates, so the distance between the two grows with the day the suite runs.
 * The app shares this machine's clock and time zone, so the runner's `new Date()` names the month the calendar opened on.
 */
async function showCalendarMonth(date: string): Promise<void> {
  const [year, month] = date.split('-').map(Number)
  const now = new Date()
  const steps = year * 12 + (month - 1) - (now.getFullYear() * 12 + now.getMonth())
  const stepButton = await browser.$(
    `button[aria-label="${steps < 0 ? 'Previous month' : 'Next month'}"]`,
  )
  await stepButton.waitForExist()
  for (let step = 0; step < Math.abs(steps); step++) {
    await stepButton.click()
  }
  const label = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'long' }).format(
    new Date(year, month - 1, 1),
  )
  await (await browser.$(`h2=${label}`)).waitForExist()
}

describe('photo-diary native restart', () => {
  it('restores SQLite state in a new app process and unregisters watching without deleting photos', async () => {
    const state = JSON.parse(readFileSync(nativeStatePath, 'utf8')) as RestartState
    expect(await browser.tauri.listWindows()).toContain('main')

    const restored = await invoke<DayPage>('get_day_photos', {
      date: state.date,
      cursor: null,
      limit: 120,
      starredOnly: false,
    })
    const edited = restored.photos.find((photo) => Number(photo.id) === state.photoId)
    expect(edited?.caption).toBe('native caption')
    expect(edited?.starred).toBe(true)
    expect((await invoke<StatsDto>('get_stats')).photoCount).toBe(state.expectedPhotoCount)

    const overrides = await invoke<EventOverrideDto[]>('list_event_overrides')
    expect(overrides).toContainEqual({
      id: `event:${state.eventStart}:${state.eventEnd}`,
      startDate: state.eventStart,
      endDate: state.eventEnd,
      title: 'Native multi-night event',
      note: 'Persists across a real app restart',
    })

    await browser.execute(() => {
      localStorage.setItem('photo-diary-locale', 'en')
      localStorage.setItem('photo-diary-theme', 'light')
    })
    await browser.refresh()
    const eventTitle = await browser.$('input[aria-label="Event title"]')
    await eventTitle.waitForExist()
    expect(await eventTitle.getValue()).toBe('Native multi-night event')
    const eventNote = await browser.$('textarea[aria-label="Event note"]')
    expect(await eventNote.getValue()).toBe('Persists across a real app restart')

    const calendarLink = await browser.$('a[href="/calendar"]')
    await calendarLink.click()
    await showCalendarMonth(state.eventStart)
    const eventBandSelector =
      '[data-testid="calendar-event-band"][aria-label="Event: Native multi-night event"]'
    // The month's rows arrive over IPC after the header has switched.
    await (await browser.$(eventBandSelector)).waitForExist()
    const eventBands = await browser.$$(eventBandSelector)
    expect(eventBands).toHaveLength(2)

    const folders = await invoke<FolderDto[]>('list_folders')
    expect(folders).toHaveLength(1)
    await invoke('remove_folder', { folderId: Number(folders[0].id) })
    expect(await invoke<FolderDto[]>('list_folders')).toHaveLength(0)
    expect((await invoke<StatsDto>('get_stats')).photoCount).toBe(state.expectedPhotoCount)
    expect(existsSync(state.storePath)).toBe(true)
  })
})
