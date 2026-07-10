import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useUi } from '@/app/ui-store'
import { CloseIcon } from '@/ui/icons'

/**
 * Transient error toast, fed by the QueryCache `onError` handler (so any failed
 * query surfaces to the user instead of failing silently). Auto-dismisses.
 */
export function Toast() {
  const { t } = useTranslation()
  const toastKey = useUi((s) => s.toastKey)
  const toastParams = useUi((s) => s.toastParams)
  const dismiss = useUi((s) => s.dismissToast)

  useEffect(() => {
    if (!toastKey) return
    const id = window.setTimeout(dismiss, 6000)
    return () => window.clearTimeout(id)
  }, [toastKey, dismiss])

  if (!toastKey) return null

  return (
    <div
      role="alert"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-lg border border-border bg-card text-card-foreground shadow-pop px-4 py-3 max-w-[360px]"
    >
      <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-destructive" />
      <span className="text-[12px]">{t(toastKey, toastParams)}</span>
      <button
        type="button"
        aria-label={t('errors.dismiss')}
        className="ml-auto text-muted-foreground hover:text-foreground"
        onClick={dismiss}
      >
        <CloseIcon className="w-4 h-4" />
      </button>
    </div>
  )
}
