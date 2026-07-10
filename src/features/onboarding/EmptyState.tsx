import { useEffect, useRef } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { useFolders } from '@/app/queries'
import { useAddPhotos } from '@/app/use-add-photos'
import { Button } from '@/ui/Button'

/** Onboarding shown when no folder is registered yet (1h). */
export function EmptyState() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: folders } = useFolders()
  const { addPhotos, isPending } = useAddPhotos()

  // Once an import fills a library that began empty, leave onboarding for the timeline.
  // Reacting to `folders` (rather than navigating straight after the import) avoids racing
  // the folders refetch; the AppShell guard handles the reverse (empty → /welcome).
  const startedEmpty = useRef<boolean | null>(null)
  useEffect(() => {
    if (!folders) return
    if (startedEmpty.current === null) startedEmpty.current = folders.length === 0
    if (startedEmpty.current && folders.length > 0) navigate('/', { replace: true })
  }, [folders, navigate])

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
        <div className="mt-6 flex items-center justify-center">
          <Button size="lg" onClick={() => void addPhotos()} disabled={isPending}>
            {t('onboarding.chooseFolder')}
          </Button>
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
