import { buildMonthCells, type MonthCell } from '@/domain/calendar'
import { buildHeatWeeks, type HeatWeek } from '@/domain/heatmap'
import type {
  DayEntry,
  HighlightsData,
  ImportProgress,
  ImportResult,
  LibraryStats,
  Photo,
  PlaceFacet,
  WatchedFolder,
} from '@/domain/models'
import type { PhotoLibrary } from '@/domain/ports'
import { folders, highlights, julyRecords, placeFacets, stats, timeline } from './fixtures'

/**
 * Phase 1 in-memory implementation; swapped for TauriPhotoLibrary in phase 2.
 * The UI depends only on the PhotoLibrary port, so the swap is painless.
 */
export class MockPhotoLibrary implements PhotoLibrary {
  private readonly days = timeline

  listTimeline(): Promise<DayEntry[]> {
    return Promise.resolve(this.days)
  }

  // Phase 1: the mock is fixed to July 2026, so year/month are accepted but ignored.
  getMonth(_year: number, _month: number): Promise<MonthCell[]> {
    return Promise.resolve(
      buildMonthCells({ leadingBlanks: 3, daysInMonth: 31, today: 5, records: julyRecords }),
    )
  }

  getHeatmap(_year: number): Promise<HeatWeek[]> {
    return Promise.resolve(buildHeatWeeks())
  }

  getHighlights(): Promise<HighlightsData> {
    return Promise.resolve(highlights)
  }

  getStats(): Promise<LibraryStats> {
    return Promise.resolve(stats)
  }

  listFolders(): Promise<WatchedFolder[]> {
    return Promise.resolve(folders)
  }

  listPlaceFacets(): Promise<PlaceFacet[]> {
    return Promise.resolve(placeFacets)
  }

  // Simulate an import so the browser-dev overlay shows real progress (no real files).
  async importFolder(
    _path: string,
    onProgress?: (p: ImportProgress) => void,
  ): Promise<ImportResult> {
    const total = 24
    for (let current = 1; current <= total; current++) {
      onProgress?.({ current, total, filename: `IMG_${1000 + current}.jpg` })
      await new Promise((resolve) => setTimeout(resolve, 60))
    }
    return {
      imported: total,
      skipped: 0,
      skippedUnsupported: 0,
      bytesSaved: 0,
      failed: [],
      scanErrors: [],
    }
  }

  saveNote(date: string, note: string): Promise<void> {
    const day = this.days.find((d) => d.date === date)
    if (day && day.kind !== 'empty') {
      day.note = note
    }
    return Promise.resolve()
  }

  toggleStar(photoId: string): Promise<void> {
    const all: Photo[] = [
      ...this.days.flatMap((d) =>
        d.kind === 'photos' ? d.photos : d.kind === 'digest' ? d.cover : [],
      ),
      ...highlights.months.flatMap((m) => m.photos),
    ]
    const target = all.find((p) => p.id === photoId)
    if (target) {
      target.starred = !target.starred
    }
    return Promise.resolve()
  }
}
