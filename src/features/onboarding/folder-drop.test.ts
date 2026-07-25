import type { DragDropEvent } from '@tauri-apps/api/webview'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const tauri = vi.hoisted(() => ({
  getCurrentWebview: vi.fn(),
  onDragDropEvent: vi.fn(),
  unlisten: vi.fn(),
}))

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: tauri.getCurrentWebview,
}))

import { subscribeToFolderDrops } from './folder-drop'

describe('subscribeToFolderDrops', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tauri.getCurrentWebview.mockReturnValue({ onDragDropEvent: tauri.onDragDropEvent })
    tauri.onDragDropEvent.mockResolvedValue(tauri.unlisten)
  })

  it('uses Tauri onDragDropEvent and maps over, leave and the first dropped path', async () => {
    const onDragging = vi.fn()
    const onDrop = vi.fn()

    const stop = await subscribeToFolderDrops({ onDragging, onDrop })
    expect(tauri.getCurrentWebview).toHaveBeenCalledOnce()
    expect(tauri.onDragDropEvent).toHaveBeenCalledOnce()
    expect(stop).toBe(tauri.unlisten)

    const listener = tauri.onDragDropEvent.mock.calls[0][0] as (event: {
      payload: DragDropEvent
    }) => void
    listener({
      payload: { type: 'over', position: { x: 1, y: 2 } } as unknown as DragDropEvent,
    })
    listener({ payload: { type: 'leave' } })
    listener({
      payload: {
        type: 'drop',
        paths: ['C:\\Photos', 'C:\\Ignored'],
        position: { x: 3, y: 4 },
      } as unknown as DragDropEvent,
    })

    expect(onDragging.mock.calls).toEqual([[true], [false], [false]])
    expect(onDrop).toHaveBeenCalledOnce()
    expect(onDrop).toHaveBeenCalledWith('C:\\Photos')
  })

  it('ignores an empty drop instead of starting an invalid import', async () => {
    const onDrop = vi.fn()
    await subscribeToFolderDrops({ onDragging: vi.fn(), onDrop })
    const listener = tauri.onDragDropEvent.mock.calls[0][0] as (event: {
      payload: DragDropEvent
    }) => void

    listener({
      payload: {
        type: 'drop',
        paths: [],
        position: { x: 0, y: 0 },
      } as unknown as DragDropEvent,
    })

    expect(onDrop).not.toHaveBeenCalled()
  })
})
