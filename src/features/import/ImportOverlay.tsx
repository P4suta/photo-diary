import { useTranslation } from 'react-i18next'
import { useUi } from '@/app/ui-store'
import { Button } from '@/ui/Button'
import { ChevronDownIcon } from '@/ui/icons'

/** Import progress (1f). Panel ⇄ minimized toast. */
export function ImportOverlay() {
  const { t } = useTranslation()
  const importState = useUi((s) => s.importState)
  const setImportState = useUi((s) => s.setImportState)

  if (importState === 'closed') return null

  if (importState === 'toast') {
    return (
      <div className="fixed bottom-5 left-5 z-40 rounded-lg border border-border bg-card text-card-foreground shadow-pop px-4 py-3 flex items-center gap-3 w-[340px]">
        <div className="relative w-8 h-8 shrink-0">
          <div className="absolute inset-0 rounded-full border-2 border-muted" />
          <div className="absolute inset-0 rounded-full border-2 border-[color:var(--moss)] border-b-transparent border-l-transparent rotate-45 animate-spin" />
        </div>
        <button type="button" className="min-w-0 text-left" onClick={() => setImportState('panel')}>
          <div className="text-[12px] font-medium">
            {t('import.importing', { done: 94, total: 247 })}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground">
            {t('import.optimizing', { minutes: 4 })}
          </div>
        </button>
        <button
          type="button"
          aria-label={t('import.close')}
          className="ml-auto text-muted-foreground hover:text-foreground"
          onClick={() => setImportState('closed')}
        >
          <ChevronDownIcon className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-6">
      <button
        type="button"
        aria-label={t('import.close')}
        className="absolute inset-0 bg-black/30 cursor-default"
        onClick={() => setImportState('closed')}
      />
      <div className="relative w-[560px] max-w-full rounded-xl border border-border bg-card text-card-foreground shadow-pop p-6">
        <div className="flex items-baseline gap-2">
          <h3 className="text-[15px] font-semibold">
            {t('import.importingCount', { count: 247 })}
          </h3>
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">94 / 247</span>
        </div>
        <p className="mt-1 text-[12px] leading-5 text-muted-foreground">{t('import.body')}</p>
        <div className="mt-4 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full w-[38%] rounded-full bg-[color:var(--moss)]" />
        </div>
        <div className="mt-2 flex items-center font-mono text-[10px] text-muted-foreground">
          <span>IMG_4102.HEIC → 2026-07-04_1642.avif</span>
          <span className="ml-auto">{t('import.remaining', { minutes: 4 })}</span>
        </div>
        <div className="mt-4 rounded-md bg-secondary/70 px-3 py-2.5 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[color:var(--moss)]" />
          <span className="text-[12px] text-secondary-foreground">
            {t('import.saved', { from: '812 MB', to: '214 MB' })}
          </span>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button variant="outline" onClick={() => setImportState('closed')}>
            {t('import.pause')}
          </Button>
          <button
            type="button"
            className="ml-auto h-8 rounded-md px-3 text-[12px] text-muted-foreground hover:bg-accent"
            onClick={() => setImportState('toast')}
          >
            {t('import.continueBackground')}
          </button>
        </div>
      </div>
    </div>
  )
}
