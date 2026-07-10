// Enumerate the literal class strings statically here so Tailwind can scan them.
const HEAT_CLASSES = [
  'bg-muted',
  'bg-[color:var(--heat-1)]',
  'bg-[color:var(--heat-2)]',
  'bg-[color:var(--heat-3)]',
  'bg-[color:var(--heat-4)]',
] as const

/** Heat level (-1..4) → Tailwind class */
export function heatClass(level: number): string {
  if (level < 0) return 'bg-muted/30'
  return HEAT_CLASSES[level] ?? 'bg-muted'
}
