import { useTranslation } from 'react-i18next'
import { Button } from './Button'

/**
 * Shared load-failure panel with a retry action. Views render this when a query
 * errors so a real backend failure reads as an error (with a way out), not as an
 * empty diary indistinguishable from "no records yet".
 */
export function ErrorPanel({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-[420px] rounded-lg border border-border bg-card text-card-foreground px-5 py-6 text-center">
      <div className="text-[14px] font-semibold">{t('errors.loadTitle')}</div>
      <p className="mt-1 text-[12px] leading-5 text-muted-foreground">{t('errors.loadBody')}</p>
      {onRetry && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={onRetry}>
            {t('errors.retry')}
          </Button>
        </div>
      )}
    </div>
  )
}
