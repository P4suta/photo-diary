import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import type { HeatWeek } from '@/domain/heatmap'
import { makeFakeLibrary, renderWithProviders } from '@/test/utils'
import { YearHeatmap } from './YearHeatmap'

/** A small grid with exactly three count>0 cells (one of them a single-photo day). */
function fakeWeeks(): HeatWeek[] {
  const week = (wi: number, counts: number[]): HeatWeek => ({
    key: `w${wi}`,
    days: counts.map((count, di) => ({ key: `w${wi}d${di}`, level: count > 0 ? 2 : 0, count })),
  })
  return [week(0, [0, 0, 0, 0, 5, 0, 3]), week(1, [1, 0, 0, 0, 0, 0, 0])]
}

function renderHeatmap() {
  return renderWithProviders(<YearHeatmap year={2026} />, {
    library: makeFakeLibrary({ getHeatmap: vi.fn().mockResolvedValue(fakeWeeks()) }),
  })
}

// region assumes a full-page landmark (false positive on a fragment); color-contrast
// can't be measured in jsdom (no canvas). Disable both, matching the other a11y suites.
const opts = { rules: { region: { enabled: false }, 'color-contrast': { enabled: false } } }

describe('YearHeatmap a11y', () => {
  it('exposes only recorded days (count>0) as focusable, labelled cells', async () => {
    renderHeatmap()
    // Empty and out-of-range cells stay presentational; only the three count>0 days
    // become focusable buttons — the year never floods the tab order.
    const cells = await screen.findAllByRole('button')
    expect(cells).toHaveLength(3)
    for (const cell of cells) {
      // Accessible name = well-formed ISO date + photo count (reusing unit.photo).
      expect(cell.getAttribute('aria-label')).toMatch(/^\d{4}-\d{2}-\d{2}: \d+ photos?$/)
    }
  })

  it('has no axe violations', async () => {
    const { container } = renderHeatmap()
    await screen.findAllByRole('button')
    expect(await axe(container, opts)).toHaveNoViolations()
  })
})
