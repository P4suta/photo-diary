/** Design-token reference table (for the 1a panel). Values match the CSS variables in index.css. */

export interface TokenRow {
  name: string
  /** The light HSL value (e.g. "40 14% 97%") or a full color function */
  light: string
  dark: string
}

export const tokenRows: TokenRow[] = [
  { name: 'background', light: '40 14% 97%', dark: '30 5% 9%' },
  { name: 'foreground', light: '30 8% 16%', dark: '40 8% 88%' },
  { name: 'card', light: '0 0% 100%', dark: '30 5% 12%' },
  { name: 'muted', light: '40 10% 93%', dark: '30 4% 16%' },
  { name: 'muted-fg', light: '30 5% 46%', dark: '30 4% 56%' },
  { name: 'border', light: '38 10% 88%', dark: '30 4% 20%' },
  { name: 'primary', light: '30 8% 20%', dark: '40 8% 88%' },
  { name: 'secondary', light: '40 10% 94%', dark: '30 4% 16%' },
  { name: 'accent', light: '40 10% 92%', dark: '30 4% 18%' },
  { name: 'destructive', light: '5 55% 46%', dark: '5 50% 58%' },
  { name: 'ring', light: '30 8% 62%', dark: '30 4% 42%' },
  { name: '--moss', light: 'hsl(155 22% 40%)', dark: 'hsl(155 18% 55%)' },
]

/** To a swatch's inline background value (wraps an HSL triple in hsl()). */
export function tokenColor(value: string): string {
  return value.startsWith('hsl') ? value : `hsl(${value})`
}
