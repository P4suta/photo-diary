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
      await importFolder.mutateAsync({ path, onProgress: setImportProgress })
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
