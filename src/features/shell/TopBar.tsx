import { open } from '@tauri-apps/plugin-dialog'
import { useTranslation } from 'react-i18next'
import { isTauri } from '@/app/env'
import { useImportFolder } from '@/app/queries'
import { useUi } from '@/app/ui-store'
import { Button } from '@/ui/Button'
import { SearchBar } from './SearchBar'

export function TopBar() {
  const { t } = useTranslation()
  const setImportState = useUi((s) => s.setImportState)
  const setImportProgress = useUi((s) => s.setImportProgress)
  const showToast = useUi((s) => s.showToast)
  const importFolder = useImportFolder()

  // Pick a folder (Tauri) or use the mock (browser dev), then import through the port.
  const onAdd = async () => {
    let path = ''
    if (isTauri) {
      const dir = await open({ directory: true, multiple: false })
      if (typeof dir !== 'string') return
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
    } catch {
      // A rejected import must reach the user, not become an unhandled promise rejection.
      showToast('errors.importFailed')
    } finally {
      setImportState('closed')
      setImportProgress(null)
    }
  }

  return (
    <div className="h-[56px] shrink-0 border-b border-border flex items-center gap-3 px-6">
      <SearchBar />
      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" onClick={onAdd} disabled={importFolder.isPending}>
          {t('topbar.addPhotos')}
        </Button>
      </div>
    </div>
  )
}
