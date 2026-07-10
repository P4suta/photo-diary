import { useQueryClient } from '@tanstack/react-query'
import { open } from '@tauri-apps/plugin-dialog'
import { useTranslation } from 'react-i18next'
import { isTauri } from '@/app/env'
import { useUi } from '@/app/ui-store'
import { backend } from '@/data/tauri/commands'
import { Button } from '@/ui/Button'
import { SearchBar } from './SearchBar'

export function TopBar() {
  const { t } = useTranslation()
  const setImportState = useUi((s) => s.setImportState)
  const queryClient = useQueryClient()

  // Tauri: pick a folder and import for real, then refetch. Browser: mock progress panel.
  const onAdd = async () => {
    if (!isTauri) {
      setImportState('panel')
      return
    }
    const dir = await open({ directory: true, multiple: false })
    if (typeof dir !== 'string') return
    setImportState('toast')
    try {
      await backend.importFolder(dir)
      await queryClient.invalidateQueries()
    } finally {
      setImportState('closed')
    }
  }

  return (
    <div className="h-[56px] shrink-0 border-b border-border flex items-center gap-3 px-6">
      <SearchBar />
      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" onClick={onAdd}>
          {t('topbar.addPhotos')}
        </Button>
      </div>
    </div>
  )
}
