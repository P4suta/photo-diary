import { save } from '@tauri-apps/plugin-dialog'
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLibrary } from '@/app/library-context'
import {
  useDayPhotos,
  useHighlights,
  useSaveCaption,
  useTimeline,
  useToggleStar,
} from '@/app/queries'
import { type LightboxState, useUi } from '@/app/ui-store'
import type { DayEntry, HighlightsData, Photo } from '@/domain/models'
import { cn } from '@/lib/cn'
import { formatImportedAt, formatTakenAt } from '@/lib/datetime'
import { formatBytes } from '@/lib/format'
import { Button } from '@/ui/Button'
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, DownloadIcon } from '@/ui/icons'

/**
 * Photo lightbox (1c) plus star/caption during viewing (3b). Always dark.
 *
 * The strip is stored as photo ids + the query that backs them; the actual Photo objects
 * are resolved *live* from that query's cache, so a star toggled here (or anywhere) is
 * reflected without a stale snapshot drifting out of sync.
 */
export function Lightbox() {
  const lightbox = useUi((s) => s.lightbox)
  if (!lightbox) return null
  return lightbox.source === 'highlights' ? (
    <HighlightsLightbox state={lightbox} />
  ) : lightbox.source === 'day' ? (
    <DayLightbox state={lightbox} />
  ) : (
    <TimelineLightbox state={lightbox} />
  )
}

function DayLightbox({ state }: { state: LightboxState }) {
  const pages = useDayPhotos(state.date ?? '', false).data
  const photos = pages?.pages.flatMap((page) => page.photos) ?? []
  return <LightboxView state={state} live={new Map(photos.map((photo) => [photo.id, photo]))} />
}

/** Resolve the strip from the live timeline cache (day photos + digest covers). */
function TimelineLightbox({ state }: { state: LightboxState }) {
  const days = useTimeline().data
  return <LightboxView state={state} live={photosFromTimeline(days)} />
}

/** Resolve the strip from the live highlights cache. */
function HighlightsLightbox({ state }: { state: LightboxState }) {
  const data = useHighlights().data
  return <LightboxView state={state} live={photosFromHighlights(data)} />
}

function photosFromTimeline(days: DayEntry[] | undefined): Map<string, Photo> {
  const m = new Map<string, Photo>()
  for (const d of days ?? []) {
    if (d.kind === 'photos') for (const p of d.photos) m.set(p.id, p)
    else if (d.kind === 'digest') for (const p of d.cover) m.set(p.id, p)
  }
  return m
}

function photosFromHighlights(data: HighlightsData | undefined): Map<string, Photo> {
  const m = new Map<string, Photo>()
  for (const month of data?.months ?? []) for (const p of month.photos) m.set(p.id, p)
  return m
}

function LightboxView({ state, live }: { state: LightboxState; live: Map<string, Photo> }) {
  const { t } = useTranslation()
  const close = useUi((s) => s.closeLightbox)
  const next = useUi((s) => s.lightboxNext)
  const prev = useUi((s) => s.lightboxPrev)
  const toggleStar = useToggleStar()
  const [infoOpen, setInfoOpen] = useState(true)
  const captionInput = useRef<HTMLInputElement>(null)
  const dialog = useRef<HTMLDivElement>(null)

  // Stable working set: values track the live cache, but keys are retained for the whole
  // open session. So a photo un-starred from Highlights — which the starred-only filter
  // then drops from that query — stays on screen carrying its last (fresh) star state.
  const workingSet = useRef(new Map<string, Photo>())
  for (const [id, p] of live) workingSet.current.set(id, p)
  const photo = workingSet.current.get(state.ids[state.index])
  const hasPhoto = Boolean(photo)

  // Keep the latest mutate in a ref so the key handler registers only once.
  const mutateRef = useRef(toggleStar.mutate)
  mutateRef.current = toggleStar.mutate
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const lb = useUi.getState().lightbox
      if (!lb) return
      const target = e.target
      if (
        target instanceof Element &&
        target.matches('input, textarea, select, [contenteditable="true"]')
      ) {
        return
      }
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
          const id = lb.ids[lb.index]
          if (id) mutateRef.current(id)
          break
        }
        case 'c':
        case 'C':
          captionInput.current?.focus()
          captionInput.current?.select()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close, next, prev])

  useEffect(() => {
    if (!hasPhoto) return
    const root = dialog.current
    if (!root) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusable = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('hidden'))
    focusable()[0]?.focus()
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const elements = focusable()
      if (elements.length === 0) {
        event.preventDefault()
        root.focus()
        return
      }
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    root.addEventListener('keydown', trapFocus)
    return () => {
      root.removeEventListener('keydown', trapFocus)
      previous?.focus()
    }
  }, [hasPhoto])

  if (!photo) return null
  const starred = photo.starred
  const toggleStarNow = () => mutateRef.current(photo.id)

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label={t('lightbox.dialog')}
      tabIndex={-1}
      className="dark fixed inset-0 z-50 flex bg-[color:var(--lightbox-backdrop)] text-foreground"
    >
      {/* Viewer */}
      <div className="flex-1 min-w-0 relative flex items-center justify-center">
        <button
          type="button"
          onClick={close}
          aria-label={t('lightbox.close')}
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
          aria-label={t('lightbox.prev')}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-white/5"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={next}
          aria-label={t('lightbox.next')}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-white/5"
        >
          <ChevronRightIcon className="w-5 h-5" />
        </button>

        <ViewerImage photo={photo} />

        <div className="absolute bottom-4 inset-x-0 flex justify-center">
          <span className="font-mono text-[11px] text-muted-foreground bg-black/30 rounded px-2 py-1">
            {state.index + 1} / {state.ids.length} · {state.context} · {t('lightbox.footerHint')}
          </span>
        </div>
      </div>

      {/* Info panel */}
      {infoOpen && <InfoPanel key={photo.id} photo={photo} captionInput={captionInput} />}
    </div>
  )
}

/**
 * Full-resolution viewer image (requirement: the stored visually-lossless AVIF must
 * actually be shown). Displays the thumbnail (blurred) as an instant placeholder,
 * then swaps to the decoded full-res master. Falls back to a dimensions placeholder
 * when neither URL exists (for example, browser-development mock data).
 */
function ViewerImage({ photo }: { photo: Photo }) {
  const [fullReady, setFullReady] = useState(false)

  useEffect(() => {
    setFullReady(false)
    if (!photo.fullUrl) return
    const img = new Image()
    img.src = photo.fullUrl
    if (img.complete) {
      setFullReady(true)
      return
    }
    img.onload = () => setFullReady(true)
    return () => {
      img.onload = null
    }
  }, [photo.fullUrl])

  const src = fullReady ? photo.fullUrl : (photo.thumbUrl ?? photo.fullUrl)

  if (!src) {
    return (
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
    )
  }

  const showingPlaceholder = !fullReady && Boolean(photo.fullUrl) && Boolean(photo.thumbUrl)
  return (
    <img
      src={src}
      alt=""
      className={cn(
        'rounded-sm object-contain transition-[filter] duration-300',
        showingPlaceholder && 'blur-sm',
      )}
      style={{ maxHeight: '84%', maxWidth: '82%' }}
    />
  )
}

function InfoPanel({
  photo,
  captionInput,
}: {
  photo: Photo
  captionInput: RefObject<HTMLInputElement | null>
}) {
  const { t, i18n } = useTranslation()
  const library = useLibrary()
  const saveCaption = useSaveCaption()
  const [caption, setCaption] = useState(photo.caption ?? '')
  const [exporting, setExporting] = useState(false)
  const skipNextSave = useRef(false)
  useEffect(() => setCaption(photo.caption ?? ''), [photo.caption])
  const persistCaption = () => {
    if (skipNextSave.current) {
      skipNextSave.current = false
      return
    }
    if (caption.trim() !== (photo.caption ?? '').trim()) {
      saveCaption.mutate({ photoId: photo.id, caption })
    }
  }
  const exportCopy = async () => {
    const stem = photo.originalFilename.replace(/\.[^.]+$/, '') || 'photo'
    const destination = await save({
      defaultPath: `${stem}.avif`,
      filters: [{ name: 'AVIF', extensions: ['avif'] }],
    })
    if (typeof destination !== 'string') return
    setExporting(true)
    try {
      await library.exportPhoto(photo.id, destination)
    } finally {
      setExporting(false)
    }
  }
  return (
    <aside className="w-[300px] shrink-0 border-l border-border bg-card flex flex-col">
      <div className="px-5 pt-5 pb-4 border-b border-border">
        <div className="text-[13px] font-semibold">{t('lightbox.photoInfo')}</div>
        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
          {t('lightbox.storedInLibrary')}
        </div>
      </div>
      <div className="px-5 py-4 flex flex-col gap-4 text-[13px] overflow-y-auto">
        <label>
          <span className="font-mono text-[10px] text-muted-foreground">{t('photo.caption')}</span>
          <input
            ref={captionInput}
            value={caption}
            maxLength={240}
            placeholder={t('photo.captionPlaceholder')}
            onChange={(event) => setCaption(event.target.value.replace(/\r?\n/g, ' '))}
            onBlur={persistCaption}
            onKeyDown={(event) => {
              event.stopPropagation()
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') {
                skipNextSave.current = true
                setCaption(photo.caption ?? '')
                event.currentTarget.blur()
              }
            }}
            className="mt-1 w-full h-8 rounded-md border border-input bg-background px-2 text-[12px]"
          />
        </label>
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
        <Button
          variant="secondary"
          size="lg"
          className="w-full border border-input"
          onClick={() => void exportCopy()}
          disabled={exporting}
        >
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
