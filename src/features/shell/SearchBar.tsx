import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { usePlaceFacets } from '@/app/queries'
import type { TimelineFilter } from '@/domain/models'
import {
  type DatePreset,
  filterSearchParams,
  parseTimelineFilter,
  presetRange,
} from '@/domain/search'
import { Button } from '@/ui/Button'
import { SearchIcon } from '@/ui/icons'

export function SearchBar() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const searchString = params.toString()
  const active = useMemo(() => parseTimelineFilter(`?${searchString}`), [searchString])
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<TimelineFilter>(active ?? { places: [] })
  const panel = useRef<HTMLDivElement>(null)
  const { data: facets } = usePlaceFacets({
    startDate: draft.startDate,
    endDate: draft.endDate,
    places: [],
  })

  useEffect(() => {
    if (open) setDraft(active ?? { places: [] })
  }, [open, active])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const choosePreset = (preset: DatePreset) =>
    setDraft((value) => ({ ...value, ...presetRange(preset) }))
  const togglePlace = (place: string | null) =>
    setDraft((value) => ({
      ...value,
      places: value.places.includes(place)
        ? value.places.filter((item) => item !== place)
        : [...value.places, place],
    }))

  return (
    <div className="relative flex-1 max-w-[440px]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 w-full h-9 rounded-md bg-card border border-input px-3 text-left hover:bg-accent"
      >
        <SearchIcon className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-[13px] text-muted-foreground truncate">
          {active
            ? t('search.active', {
                from: active.startDate ?? '…',
                to: active.endDate ?? '…',
                count: active.places.length,
              })
            : t('search.placeholder')}
        </span>
      </button>
      {open && (
        <div
          ref={panel}
          className="absolute left-0 top-11 z-30 w-[440px] max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card shadow-pop p-4"
        >
          <h2 className="text-[12px] font-semibold">{t('search.periodHeading')}</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(['today', 'thisWeek', 'thisMonth', 'thisYear', 'todayLastYear'] as const).map(
              (preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => choosePreset(preset)}
                  className="rounded-md bg-secondary px-2 py-1 text-[11px] hover:bg-accent"
                >
                  {t(`search.period.${preset}`)}
                </button>
              ),
            )}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <label className="text-[11px] text-muted-foreground">
              {t('search.from')}
              <input
                type="date"
                value={draft.startDate ?? ''}
                onChange={(event) =>
                  setDraft((value) => ({ ...value, startDate: event.target.value || undefined }))
                }
                className="block mt-1 h-8 rounded-md border border-input bg-background px-2"
              />
            </label>
            <label className="text-[11px] text-muted-foreground">
              {t('search.to')}
              <input
                type="date"
                value={draft.endDate ?? ''}
                onChange={(event) =>
                  setDraft((value) => ({ ...value, endDate: event.target.value || undefined }))
                }
                className="block mt-1 h-8 rounded-md border border-input bg-background px-2"
              />
            </label>
          </div>
          <h2 className="mt-4 text-[12px] font-semibold">{t('search.placeHeading')}</h2>
          <div className="mt-2 max-h-40 overflow-y-auto flex flex-col gap-1">
            {facets?.map((facet) => {
              const value = facet.muted ? null : facet.label
              return (
                <label
                  key={facet.label}
                  className="flex items-center gap-2 rounded px-1 py-1 text-[12px] hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    checked={draft.places.includes(value)}
                    onChange={() => togglePlace(value)}
                  />
                  <span className={facet.muted ? 'text-muted-foreground' : undefined}>
                    {facet.muted ? t('search.noLocation') : facet.label}
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                    {facet.count}
                  </span>
                </label>
              )
            })}
          </div>
          <div className="mt-4 flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraft({ places: [] })
                setParams(new URLSearchParams())
                setOpen(false)
              }}
            >
              {t('search.clear')}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setParams(filterSearchParams(draft))
                setOpen(false)
              }}
            >
              {t('search.apply')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
