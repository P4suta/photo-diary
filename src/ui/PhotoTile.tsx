import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToggleStar } from '@/app/queries'
import type { AspectRatio, Photo } from '@/domain/models'
import { cn } from '@/lib/cn'

const ASPECT: Record<AspectRatio, string> = {
  '4/3': 'aspect-[4/3]',
  '3/4': 'aspect-[3/4]',
  '1/1': 'aspect-square',
}

/** Photo placeholder tile. Hover for ★/note, starred shows a badge, click opens the lightbox. */
export function PhotoTile({
  photo,
  onOpen,
  size = 'feed',
  className,
}: {
  photo: Photo
  onOpen?: () => void
  size?: 'feed' | 'grid'
  className?: string
}) {
  const { t } = useTranslation()
  const toggleStar = useToggleStar()
  const [imgError, setImgError] = useState(false)
  const showImg = !!photo.thumbUrl && !imgError
  return (
    <div className={cn('break-inside-avoid mb-2', className)}>
      <div className="relative group">
        <button
          type="button"
          onClick={onOpen}
          aria-label={t('photo.open')}
          className={cn(
            'block w-full rounded-md overflow-hidden cursor-zoom-in',
            ASPECT[photo.aspect],
            !showImg && 'ph',
          )}
        >
          {showImg && (
            <img
              src={photo.thumbUrl}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          )}
        </button>
        {photo.starred && (
          <span className="pointer-events-none absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-[color:var(--moss)] text-white text-[11px] leading-5 text-center">
            ★
          </span>
        )}
        {/* Controls are hidden with opacity:0 but stay in the DOM (and the tab order),
            so they must reveal on keyboard focus too — group-focus-within surfaces them
            when the star/note button gains focus, matching the hover affordance. */}
        <div className="pointer-events-none absolute inset-0 rounded-md bg-black/35 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex items-end justify-end p-1.5 gap-1">
          <button
            type="button"
            onClick={() => toggleStar.mutate(photo.id)}
            aria-label={t(photo.starred ? 'photo.unstar' : 'photo.star')}
            className="pointer-events-auto h-6 rounded-md bg-white/90 text-[color:var(--overlay-chip-fg)] px-2 text-[11px] hover:bg-white"
          >
            ★
          </button>
          <button
            type="button"
            onClick={onOpen}
            className="pointer-events-auto h-6 rounded-md bg-white/90 text-[color:var(--overlay-chip-fg)] px-2 text-[11px] hover:bg-white"
          >
            {t('photo.note')}
          </button>
        </div>
      </div>
      {photo.caption && (
        <p
          className={cn(
            'mt-1 text-muted-foreground',
            size === 'grid' ? 'text-[11px] leading-4' : 'text-[12px] leading-5',
          )}
        >
          {photo.caption}
        </p>
      )}
    </div>
  )
}
