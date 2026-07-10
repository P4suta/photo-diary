import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/ui/Button'

/** Onboarding shown when no folder is registered yet (1h). */
export function EmptyState() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
      <div className="w-[520px] max-w-full rounded-xl border border-dashed border-input p-10 text-center">
        <div className="flex justify-center gap-1.5">
          <div className="ph w-10 h-12 rounded-md rotate-[-6deg]" />
          <div className="ph w-10 h-12 rounded-md" />
          <div className="ph w-10 h-12 rounded-md rotate-[6deg]" />
        </div>
        <h2 className="mt-6 text-[20px] font-semibold">{t('onboarding.title')}</h2>
        <p className="mt-3 text-[13px] leading-6 text-muted-foreground text-left">
          <Trans
            i18nKey="onboarding.body"
            components={{ strong: <span className="text-foreground" /> }}
          />
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button size="lg">{t('onboarding.chooseFolder')}</Button>
          <span className="text-[12px] text-muted-foreground">{t('onboarding.orDrop')}</span>
        </div>
        <div className="mt-6 font-mono text-[10px] text-muted-foreground">
          {t('onboarding.formats')}
        </div>
        <div className="mt-6">
          <Link
            to="/"
            className="text-[12px] text-muted-foreground hover:text-foreground underline"
          >
            {t('onboarding.viewDemo')}
          </Link>
        </div>
      </div>
    </div>
  )
}
