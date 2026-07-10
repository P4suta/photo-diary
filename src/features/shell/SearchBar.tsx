import { useTranslation } from 'react-i18next'
import { SearchIcon } from '@/ui/icons'

/**
 * Search box. Real filtering (date range + place facets) is a later phase, so this
 * is an honest disabled placeholder rather than a panel of fabricated active filters.
 */
export function SearchBar() {
  const { t } = useTranslation()

  return (
    <div className="relative flex-1 max-w-[440px]">
      <div
        aria-disabled="true"
        className="flex items-center gap-2 w-full h-9 rounded-md bg-card border border-input px-3 text-left opacity-60 select-none"
      >
        <SearchIcon className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-[13px] text-muted-foreground/60">{t('search.placeholder')}</span>
      </div>
    </div>
  )
}
