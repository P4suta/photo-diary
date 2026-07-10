import { useTranslation } from 'react-i18next'
import { useAddPhotos } from '@/app/use-add-photos'
import { Button } from '@/ui/Button'
import { SearchBar } from './SearchBar'

export function TopBar() {
  const { t } = useTranslation()
  const { addPhotos, isPending } = useAddPhotos()

  return (
    <div className="h-[56px] shrink-0 border-b border-border flex items-center gap-3 px-6">
      <SearchBar />
      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" onClick={() => void addPhotos()} disabled={isPending}>
          {t('topbar.addPhotos')}
        </Button>
      </div>
    </div>
  )
}
