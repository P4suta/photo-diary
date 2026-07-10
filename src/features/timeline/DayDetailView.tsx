import { useNavigate } from 'react-router-dom'
import { ChevronLeftIcon } from '@/ui/icons'

// Phase 2b static mock: a preview of the day-detail screen (virtual scroll not built
// yet). Content here is placeholder, not driven by the domain.

/** One time-cluster chapter: title + time range + count, over a grid-cols-12 .ph tile set. */
function ClusterSection({
  title,
  range,
  tileCount,
  pickup,
}: {
  title: string
  range: string
  tileCount: number
  pickup?: number
}) {
  return (
    <>
      <div className="flex items-baseline gap-2 mt-6 first:mt-0">
        <h3 className="text-[13px] font-semibold">{title}</h3>
        <span className="font-mono text-[10px] text-muted-foreground">{range}</span>
        {pickup !== undefined && (
          <button
            type="button"
            className="ml-auto text-[11px] text-muted-foreground hover:text-foreground"
          >
            ☆ Picks only <span className="font-mono">{pickup}</span>
          </button>
        )}
      </div>
      <div className="grid grid-cols-12 gap-1 mt-2">
        {Array.from({ length: tileCount }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable static mock tiles
          <div key={i} className="ph rounded-[4px] aspect-square cursor-zoom-in" />
        ))}
      </div>
    </>
  )
}

/** Day detail view (2b): time-cluster chapters + tile grid + a time scrubber on the right. */
export function DayDetailView() {
  const navigate = useNavigate()

  return (
    <div className="h-full overflow-hidden bg-background text-foreground flex flex-col">
      <div className="h-[56px] shrink-0 border-b border-border flex items-center gap-3 px-5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          title="Back to timeline"
          className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>
        <div className="flex items-baseline gap-2">
          <h2 className="text-[15px] font-semibold">July 22 (Wed)</h2>
          <span className="text-[12px] text-muted-foreground">Kanazawa</span>
          <span className="font-mono text-[11px] text-muted-foreground">4,318 photos</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-md border border-input overflow-hidden">
            <button
              type="button"
              title="Large"
              className="w-8 h-7 flex items-center justify-center text-muted-foreground hover:bg-accent"
            >
              <div className="w-3 h-3 rounded-[2px] border border-current" />
            </button>
            <button
              type="button"
              title="Medium"
              className="w-8 h-7 flex items-center justify-center bg-secondary text-secondary-foreground border-x border-input"
            >
              <div className="w-2 h-2 rounded-[1px] border border-current" />
            </button>
            <button
              type="button"
              title="Small"
              className="w-8 h-7 flex items-center justify-center text-muted-foreground hover:bg-accent"
            >
              <div className="w-1.5 h-1.5 rounded-[1px] border border-current" />
            </button>
          </div>
          <button
            type="button"
            className="h-7 rounded-md border border-input px-3 text-[12px] text-secondary-foreground hover:bg-accent"
          >
            Select
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 overflow-y-auto px-6 py-5">
          <ClusterSection
            title="Departure & around the hotel"
            range="07:40 – 08:12 · 12 photos"
            tileCount={12}
          />

          <ClusterSection
            title="Kenroku-en"
            range="10:15 – 12:02 · 1,428 photos"
            tileCount={48}
            pickup={24}
          />
          <div className="relative h-10 -mt-10 bg-gradient-to-t from-background to-transparent pointer-events-none" />
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">
            ↓ 1,380 more (virtual scroll — only the visible rows are in the DOM)
          </div>
        </div>

        {/* Time scrubber */}
        <div className="w-[64px] shrink-0 border-l border-border relative py-5">
          <div className="absolute left-1/2 top-5 bottom-5 w-px bg-border" />
          <div className="absolute left-0 right-0 top-[8%] flex items-center justify-center">
            <span className="font-mono text-[9px] text-muted-foreground bg-background px-1">
              07
            </span>
          </div>
          <div className="absolute left-0 right-0 top-[26%] flex items-center justify-center">
            <span className="font-mono text-[9px] text-muted-foreground bg-background px-1">
              10
            </span>
          </div>
          <div className="absolute left-0 right-0 top-[44%] flex items-center justify-center">
            <span className="font-mono text-[9px] text-muted-foreground bg-background px-1">
              13
            </span>
          </div>
          <div className="absolute left-0 right-0 top-[62%] flex items-center justify-center">
            <span className="font-mono text-[9px] text-muted-foreground bg-background px-1">
              16
            </span>
          </div>
          <div className="absolute left-0 right-0 top-[80%] flex items-center justify-center">
            <span className="font-mono text-[9px] text-muted-foreground bg-background px-1">
              19
            </span>
          </div>
          <div className="absolute left-0 right-0 top-[31%] flex justify-center">
            <div className="rounded-md bg-primary text-primary-foreground font-mono text-[10px] px-1.5 py-1 shadow-pop cursor-grab">
              11:24
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
