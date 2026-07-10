import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlaceFacets } from '@/app/queries'
import { cn } from '@/lib/cn'
import { formatCount } from '@/lib/format'
import { Button } from '@/ui/Button'
import { CheckIcon, SearchIcon } from '@/ui/icons'

const PERIODS = ['today', 'thisWeek', 'thisMonth', 'thisYear', 'todayLastYear'] as const

/** Collapsible search bar + expanded panel (date range, place facets). 1b / 1e */
export function SearchBar() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative flex-1 max-w-[440px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 w-full h-9 rounded-md bg-card px-3 text-left transition',
          open ? 'border border-ring ring-2 ring-[hsl(var(--ring))]/25' : 'border border-input',
        )}
      >
        <SearchIcon className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="inline-flex items-center gap-1 rounded bg-secondary text-secondary-foreground font-mono text-[11px] px-1.5 py-0.5">
          7/1 – 7/5<span className="text-muted-foreground">×</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-secondary text-secondary-foreground text-[11px] px-1.5 py-0.5">
          Shibuya<span className="text-muted-foreground">×</span>
        </span>
        <span className="text-[13px] text-muted-foreground/60">{t('search.placeholder')}</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label={t('search.close')}
            className="fixed inset-0 z-20 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30">
            <SearchPanel onApply={() => setOpen(false)} />
          </div>
        </>
      )}
    </div>
  )
}

function SearchPanel({ onApply }: { onApply: () => void }) {
  const { t } = useTranslation()
  const { data: facets } = usePlaceFacets()
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('thisMonth')
  const [selected, setSelected] = useState<Set<string>>(() => new Set(['Shibuya']))

  const toggle = (label: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })

  return (
    <div className="rounded-lg border border-border bg-card shadow-pop overflow-hidden">
      <div className="px-4 pt-3.5 pb-3 border-b border-border/60">
        <div className="font-mono text-[10px] text-muted-foreground mb-2">
          {t('search.periodHeading')}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[12px] transition-colors',
                p === period
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-input text-secondary-foreground hover:bg-accent',
              )}
            >
              {t(`search.period.${p}`)}
            </button>
          ))}
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <div className="flex-1 h-8 rounded-md border border-input bg-background px-2.5 flex items-center font-mono text-[12px]">
            2026/07/01
          </div>
          <span className="text-muted-foreground text-[12px]">→</span>
          <div className="flex-1 h-8 rounded-md border border-input bg-background px-2.5 flex items-center font-mono text-[12px]">
            2026/07/05
          </div>
        </div>
      </div>

      <div className="px-4 pt-3 pb-2">
        <div className="font-mono text-[10px] text-muted-foreground mb-1.5">
          {t('search.placeHeading')}
        </div>
        <div className="flex flex-col">
          {facets?.map((f) => {
            const on = selected.has(f.label)
            return (
              <label key={f.label} className="flex items-center gap-2.5 py-1.5 cursor-pointer">
                <span
                  className={cn(
                    'w-4 h-4 rounded-sm flex items-center justify-center',
                    on ? 'bg-primary' : 'border border-input',
                  )}
                >
                  {on && <CheckIcon className="w-3 h-3 text-primary-foreground" />}
                </span>
                <span className={cn('text-[13px]', f.muted && 'text-muted-foreground')}>
                  {f.label}
                </span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                  {formatCount(f.count)}
                </span>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  onChange={() => toggle(f.label)}
                />
              </label>
            )
          })}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-border/60 flex items-center">
        <button type="button" className="text-[12px] text-muted-foreground hover:text-foreground">
          {t('search.clear')}
        </button>
        <Button size="lg" className="ml-auto" onClick={onApply}>
          {t('search.apply')}
        </Button>
      </div>
    </div>
  )
}
