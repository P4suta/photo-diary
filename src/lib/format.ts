export function formatCount(n: number): string {
  return n.toLocaleString('en-US')
}

/** Human-readable bytes: GB with 1 decimal, MB integer at ≥100 else 2 decimals. */
export function formatBytes(bytes: number): string {
  const GB = 1024 ** 3
  const MB = 1024 ** 2
  const KB = 1024
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`
  if (bytes >= MB) {
    const v = bytes / MB
    return `${v >= 100 ? Math.round(v) : v.toFixed(2)} MB`
  }
  if (bytes >= KB) return `${Math.round(bytes / KB)} KB`
  return `${bytes} B`
}

/** Split into value + unit for stat cards: 13314398618 → { value: "12.4", unit: "GB" }. */
export function splitBytes(bytes: number): { value: string; unit: string } {
  // formatBytes always returns "N U" (space-separated), so both parts are defined.
  const [value, unit] = formatBytes(bytes).split(' ')
  return { value, unit }
}
