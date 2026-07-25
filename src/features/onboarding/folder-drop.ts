import { getCurrentWebview } from '@tauri-apps/api/webview'

interface FolderDropHandlers {
  onDragging: (dragging: boolean) => void
  onDrop: (path: string) => void
}

/**
 * Registers the official Tauri Webview drag/drop listener and reduces its event union to the
 * two actions onboarding needs. The caller owns the returned unlisten function.
 */
export function subscribeToFolderDrops({ onDragging, onDrop }: FolderDropHandlers) {
  return getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type === 'over') onDragging(true)
    if (event.payload.type === 'leave') onDragging(false)
    if (event.payload.type === 'drop') {
      onDragging(false)
      const path = event.payload.paths[0]
      if (path) onDrop(path)
    }
  })
}
