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
    const eventBands = await browser.$$(
      '[data-testid="calendar-event-band"][aria-label="Event: Native multi-night event"]',
    )
    expect(eventBands).toHaveLength(2)

    const folders = await invoke<FolderDto[]>('list_folders')
    expect(folders).toHaveLength(1)
    await invoke('remove_folder', { folderId: Number(folders[0].id) })
    expect(await invoke<FolderDto[]>('list_folders')).toHaveLength(0)
    expect((await invoke<StatsDto>('get_stats')).photoCount).toBe(state.expectedPhotoCount)
    expect(existsSync(state.storePath)).toBe(true)
  })
})
