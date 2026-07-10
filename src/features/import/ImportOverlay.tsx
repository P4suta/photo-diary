import { useTranslation } from 'react-i18next'
import { useUi } from '@/app/ui-store'

/** Import progress (1f). Panel ⇄ minimized toast. Driven by the real per-file channel. */
export function ImportOverlay() {
  const { t } = useTranslation()
  const importState = useUi((s) => s.importState)
  const setImportState = useUi((s) => s.setImportState)
  const progress = useUi((s) => s.importProgress)

  if (importState === 'closed') return null

  const done = progress?.current ?? 0
  const total = progress?.total ?? 0
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  if (importState === 'toast') {
    return (
      <div className="fixed bottom-5 left-5 z-40 rounded-lg border border-border bg-card text-card-foreground shadow-pop px-4 py-3 flex items-center gap-3 w-[340px]">
        <div className="relative w-8 h-8 shrink-0">
          <div className="absolute inset-0 rounded-full border-2 border-muted" />
          <div className="absolute inset-0 rounded-full border-2 border-[color:var(--moss)] border-b-transparent border-l-transparent rotate-45 animate-spin" />
        </div>
        <button
          type="button"
          className="min-w-0 text-left w-full"
          onClick={() => setImportState('panel')}
        >
          <div className="text-[12px] font-medium">{t('import.importing', { done, total })}</div>
          {progress && (
            <div className="font-mono text-[10px] text-muted-foreground truncate">
              {progress.filename}
            </div>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative w-[560px] max-w-full rounded-xl border border-border bg-card text-card-foreground shadow-pop p-6">
        <div className="flex items-baseline gap-2">
          <h3 className="text-[15px] font-semibold">
            {total > 0 ? t('import.importingCount', { count: total }) : t('import.preparing')}
          </h3>
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">
            {done} / {total}
          </span>
        </div>
        <p className="mt-1 text-[12px] leading-5 text-muted-foreground">{t('import.body')}</p>
        <div className="mt-4 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-[color:var(--moss)] transition-[width] duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
        {progress && (
          <div className="mt-2 flex items-center font-mono text-[10px] text-muted-foreground">
            <span className="truncate">{progress.filename}</span>
            <span className="ml-auto shrink-0">{pct}%</span>
          </div>
        )}
        <div className="mt-4 flex items-center gap-2">
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
