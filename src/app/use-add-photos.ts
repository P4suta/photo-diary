import { open } from '@tauri-apps/plugin-dialog'
import { isTauri } from './env'
import { useImportFolder } from './queries'
import { useUi } from './ui-store'

/**
 * Shared "add photos" flow: pick a folder (Tauri) or use the mock (browser dev), import
 * through the port, and surface per-file failures / undecodable skips as a toast. Lives in
 * the app layer so both the TopBar and the onboarding CTA use one implementation instead
 * of a cross-feature import.
 */
export function useAddPhotos() {
  const setImportState = useUi((s) => s.setImportState)
  const setImportProgress = useUi((s) => s.setImportProgress)
  const showToast = useUi((s) => s.showToast)
  const importFolder = useImportFolder()

  /** Runs the import; resolves true if an import completed, false if cancelled/failed. */
  const addPhotos = async (): Promise<boolean> => {
    let path = ''
    if (isTauri) {
      const dir = await open({ directory: true, multiple: false })
      if (typeof dir !== 'string') return false
      path = dir
    }
    setImportProgress(null)
    setImportState('panel')
    try {
      const result = await importFolder.mutateAsync({ path, onProgress: setImportProgress })
      // A successful import can still leave per-file failures / undecodable files behind —
      // surface them instead of closing the overlay as if everything went in.
      const failed = result.failed.length + result.scanErrors.length
      if (failed > 0 || result.skippedUnsupported > 0) {
        showToast('import.completedWithIssues', { failed, skipped: result.skippedUnsupported })
      }
      return true
    } catch {
      // A rejected import must reach the user, not become an unhandled promise rejection.
      showToast('errors.importFailed')
      return false
    } finally {
      setImportState('closed')
      setImportProgress(null)
    }
  }

  return { addPhotos, isPending: importFolder.isPending }
}
