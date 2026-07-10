import { tokenColor, tokenRows } from '@/domain/tokens'

/** Design token reference (1a). Values match the CSS variables in index.css. */
export function TokensView() {
  return (
    <div className="p-8">
      <div className="max-w-[920px] grid grid-cols-[1fr_300px] gap-10">
        <div>
          <h2 className="text-[13px] font-semibold text-muted-foreground tracking-wide mb-3">
            Colors — CSS variables (shadcn/ui compatible)
          </h2>
          <div className="grid grid-cols-[120px_1fr_1fr] items-center text-[11px] font-mono text-muted-foreground pb-1.5 border-b border-border">
            <span>token</span>
            <span>light</span>
            <span>dark</span>
          </div>
          {tokenRows.map((t) => (
            <div
              key={t.name}
              className="grid grid-cols-[120px_1fr_1fr] items-center gap-2 py-1.5 border-b border-border/50"
            >
              <span className="font-mono text-[11px]">{t.name}</span>
              <span className="flex items-center gap-2">
                <span
                  className="w-8 h-5 rounded-sm border border-border"
                  style={{ background: tokenColor(t.light) }}
                />
                <span className="font-mono text-[10px] text-muted-foreground">{t.light}</span>
              </span>
              <span className="flex items-center gap-2">
                <span
                  className="w-8 h-5 rounded-sm border border-border"
                  style={{ background: tokenColor(t.dark) }}
                />
                <span className="font-mono text-[10px] text-muted-foreground">{t.dark}</span>
              </span>
            </div>
          ))}
          <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
            Accent <span className="font-mono">--moss</span> is used only for the heatmap and the
            "today" marker. The UI base stays neutral.
          </p>
        </div>

        <div className="flex flex-col gap-7">
          <div>
            <h2 className="text-[13px] font-semibold text-muted-foreground tracking-wide mb-3">
              Typography
            </h2>
            <div className="flex flex-col gap-2.5">
              <div className="text-[20px] font-semibold leading-snug">Screen heading 20 / 600</div>
              <div className="text-[17px] font-semibold">Date header 17 / 600</div>
              <div className="text-[15px] leading-7">Body / note 15 / 400</div>
              <div className="text-[13px] text-muted-foreground">UI label 13 / 400</div>
              <div className="font-mono text-[11px] text-muted-foreground">Metadata mono 11</div>
            </div>
          </div>
          <div>
            <h2 className="text-[13px] font-semibold text-muted-foreground tracking-wide mb-3">
              Radius, shadow, spacing
            </h2>
            <div className="flex items-end gap-3">
              <div className="w-12 h-12 bg-card border border-border rounded-sm shadow-card" />
              <div className="w-12 h-12 bg-card border border-border rounded-md shadow-card" />
              <div className="w-12 h-12 bg-card border border-border rounded-lg shadow-pop" />
            </div>
            <div className="mt-2 font-mono text-[10px] text-muted-foreground">
              sm 6px · md 8px · lg 12px / shadow-card, shadow-pop
            </div>
            <div className="mt-4 flex items-end gap-1.5">
              <div className="w-1 h-1 bg-foreground/40" />
              <div className="w-2 h-2 bg-foreground/40" />
              <div className="w-3 h-3 bg-foreground/40" />
              <div className="w-4 h-4 bg-foreground/40" />
              <div className="w-6 h-6 bg-foreground/40" />
              <div className="w-8 h-8 bg-foreground/40" />
            </div>
            <div className="mt-2 font-mono text-[10px] text-muted-foreground">
              spacing 4 / 8 / 12 / 16 / 24 / 32
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
