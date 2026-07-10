import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToggleStar } from '@/app/queries'
import { useUi } from '@/app/ui-store'
import type { Photo } from '@/domain/models'
import { cn } from '@/lib/cn'
import { formatImportedAt, formatTakenAt } from '@/lib/datetime'
import { formatBytes } from '@/lib/format'
import { Button } from '@/ui/Button'
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, DownloadIcon } from '@/ui/icons'

/** Photo lightbox (1c) plus star/caption during viewing (3b). Always dark. */
export function Lightbox() {
  const { t } = useTranslation()
  const lightbox = useUi((s) => s.lightbox)
  const close = useUi((s) => s.closeLightbox)
  const next = useUi((s) => s.lightboxNext)
  const prev = useUi((s) => s.lightboxPrev)
  const toggleStar = useToggleStar()

  const [infoOpen, setInfoOpen] = useState(true)
  const [starred, setStarred] = useState(false)

  // Sync the star state whenever the index/photo changes.
  useEffect(() => {
    if (lightbox) setStarred(lightbox.photos[lightbox.index]?.starred ?? false)
  }, [lightbox])

  // Keep the latest mutate in a ref so the key handler registers only once.
  const mutateRef = useRef(toggleStar.mutate)
  mutateRef.current = toggleStar.mutate
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const lb = useUi.getState().lightbox
      if (!lb) return
      switch (e.key) {
        case 'Escape':
          close()
          break
        case 'ArrowLeft':
          prev()
          break
        case 'ArrowRight':
          next()
          break
        case 'i':
        case 'I':
          setInfoOpen((v) => !v)
          break
        case 's':
        case 'S': {
          const p = lb.photos[lb.index]
          if (p) {
            mutateRef.current(p.id)
            setStarred((v) => !v)
          }
          break
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close, next, prev])

  if (!lightbox) return null
  const photo = lightbox.photos[lightbox.index]
  if (!photo) return null

  const toggleStarNow = () => {
    mutateRef.current(photo.id)
    setStarred((v) => !v)
  }

  return (
    <div className="dark fixed inset-0 z-50 flex bg-[hsl(30_5%_7%)] text-foreground">
      {/* Viewer */}
      <div className="flex-1 min-w-0 relative flex items-center justify-center">
        <button
          type="button"
          onClick={close}
          title={t('lightbox.close')}
          className="absolute top-4 left-4 w-9 h-9 rounded-md flex items-center justify-center text-muted-foreground hover:bg-white/5"
        >
          <CloseIcon className="w-[18px] h-[18px]" />
        </button>

        <button
          type="button"
          onClick={toggleStarNow}
          className={cn(
            'absolute top-4 right-4 h-8 rounded-md px-2.5 text-[12px] font-medium z-10',
            starred
              ? 'bg-[color:var(--moss)] text-white'
              : 'border border-border text-muted-foreground hover:bg-white/5',
          )}
        >
          {starred ? t('lightbox.starred') : t('lightbox.star')}
        </button>

        <button
          type="button"
          onClick={prev}
          title={t('lightbox.prev')}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-white/5"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={next}
          title={t('lightbox.next')}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-white/5"
        >
          <ChevronRightIcon className="w-5 h-5" />
        </button>

        {photo.thumbUrl ? (
          <img
            src={photo.thumbUrl}
            alt=""
            className="rounded-sm object-contain"
            style={{ maxHeight: '84%', maxWidth: '82%' }}
          />
        ) : (
          <div
            className="ph rounded-sm flex items-center justify-center"
            style={{
              height: '70%',
              maxWidth: '80%',
              aspectRatio: photo.aspect.replace('/', ' / '),
            }}
          >
            <span className="font-mono text-[11px] text-muted-foreground">
              photo · {photo.width} × {photo.height}
            </span>
          </div>
        )}

        <div className="absolute bottom-4 inset-x-0 flex justify-center">
          <span className="font-mono text-[11px] text-muted-foreground bg-black/30 rounded px-2 py-1">
            {lightbox.index + 1} / {lightbox.photos.length} · {lightbox.context} ·{' '}
            {t('lightbox.footerHint')}
          </span>
        </div>
      </div>

      {/* Info panel */}
      {infoOpen && <InfoPanel photo={photo} />}
    </div>
  )
}

function InfoPanel({ photo }: { photo: Photo }) {
  const { t, i18n } = useTranslation()
  return (
    <aside className="w-[300px] shrink-0 border-l border-border bg-card flex flex-col">
      <div className="px-5 pt-5 pb-4 border-b border-border">
        <div className="text-[13px] font-semibold">{t('lightbox.photoInfo')}</div>
        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
          {t('lightbox.storedInLibrary')}
        </div>
      </div>
      <div className="px-5 py-4 flex flex-col gap-4 text-[13px] overflow-y-auto">
        <Field label={t('lightbox.fieldTakenAt')}>
          {formatTakenAt(photo.takenAt, i18n.language)}
        </Field>
        <div>
          <div className="font-mono text-[10px] text-muted-foreground mb-0.5">
            {t('lightbox.fieldPlace')}
          </div>
          {photo.place ? (
            <>
              <div>{photo.place}</div>
              {photo.lat != null && photo.lng != null && (
                <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                  {photo.lat}, {photo.lng}
                </div>
              )}
            </>
          ) : (
            <div className="text-muted-foreground">{t('lightbox.noPlace')}</div>
          )}
        </div>
        <Field label={t('lightbox.fieldDimensions')}>
          {photo.width} × {photo.height}{' '}
          <span className="text-muted-foreground">· {photo.megapixels} MP</span>
        </Field>
        <Field label={t('lightbox.fieldStoredSize')}>
          {formatBytes(photo.sizeBytes)}{' '}
          <span className="text-muted-foreground">
            · {photo.format} · {photo.quality}
          </span>
        </Field>
        <div>
          <div className="font-mono text-[10px] text-muted-foreground mb-0.5">
            {t('lightbox.fieldFilename')}
          </div>
          <div className="font-mono text-[12px]">{photo.originalFilename}</div>
          <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
            {t('lightbox.importedAt', { time: formatImportedAt(photo.importedAt, i18n.language) })}
          </div>
        </div>
      </div>
      <div className="mt-auto px-5 pb-5 pt-3 border-t border-border">
        <Button variant="secondary" size="lg" className="w-full border border-input">
          <DownloadIcon className="w-4 h-4" />
          {t('lightbox.exportCopy')}
        </Button>
        <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
          {t('lightbox.exportHint')}
        </p>
      </div>
    </aside>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[10px] text-muted-foreground mb-0.5">{label}</div>
      <div>{children}</div>
    </div>
  )
}
