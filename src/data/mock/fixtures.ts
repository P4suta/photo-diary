import type {
  AspectRatio,
  DayEntry,
  HighlightsData,
  LibraryStats,
  Photo,
  PlaceFacet,
  WatchedFolder,
} from '@/domain/models'

const DIMS: Record<AspectRatio, [number, number]> = {
  '4/3': [4032, 3024],
  '3/4': [3024, 4032],
  '1/1': [3024, 3024],
}

let seq = 0
/** Photo factory. Default metadata matches the 1c info panel (a shot in Shibuya). */
function photo(aspect: AspectRatio, over: Partial<Photo> = {}): Photo {
  seq += 1
  const [width, height] = DIMS[aspect]
  return {
    id: `p${seq}`,
    aspect,
    takenAt: '2026-07-04T16:42:00',
    place: null,
    starred: false,
    caption: null,
    width,
    height,
    megapixels: Math.round((width * height) / 100000) / 10,
    sizeBytes: 1_929_379,
    format: 'AVIF',
    quality: 'Visually lossless',
    originalFilename: 'IMG_4213.HEIC',
    importedAt: '2026-07-04T17:03:00',
    lat: null,
    lng: null,
    ...over,
  }
}

const shibuya = { place: 'Shibuya, Tokyo', lat: 35.6595, lng: 139.7005 } as const

/** Timeline: today (7/5) first, chronological descending. 1b states + 2a digest. */
export const timeline: DayEntry[] = [
  {
    kind: 'photos',
    date: '2026-07-05',
    place: null,
    today: true,
    note: 'Yoyogi Park in the morning. It was cool around the fountain.',
    photos: [
      photo('4/3', { takenAt: '2026-07-05T07:48:00' }),
      photo('3/4', { takenAt: '2026-07-05T08:05:00' }),
      photo('1/1', { takenAt: '2026-07-05T08:12:00' }),
      photo('4/3', { takenAt: '2026-07-05T09:20:00' }),
    ],
  },
  {
    kind: 'photos',
    date: '2026-07-04',
    place: 'Shibuya',
    today: false,
    note: 'Evening on the rooftop after the used bookshop. The sky changed color every ten minutes and I ended up taking six shots. The smell of early summer.',
    photos: [
      photo('3/4', shibuya),
      photo('4/3', shibuya),
      photo('1/1', shibuya),
      photo('4/3', shibuya),
      photo('3/4', shibuya),
      photo('4/3', shibuya),
    ],
  },
  {
    kind: 'empty',
    date: '2026-07-03',
    place: null,
    today: false,
  },
  {
    kind: 'photos',
    date: '2026-07-02',
    place: null,
    today: false,
    note: null,
    photos: [
      photo('4/3', { takenAt: '2026-07-02T10:00:00' }),
      photo('1/1', { takenAt: '2026-07-02T12:30:00' }),
      photo('3/4', { takenAt: '2026-07-02T15:10:00' }),
      photo('4/3', { takenAt: '2026-07-02T17:40:00' }),
      photo('4/3', { takenAt: '2026-07-02T18:05:00' }),
    ],
  },
  {
    kind: 'note_only',
    date: '2026-07-01',
    place: null,
    today: false,
    note: 'Rain all day. I did not take the camera out, but let me note that July has begun.',
  },
  {
    kind: 'digest',
    date: '2026-06-28',
    place: 'Kanazawa',
    today: false,
    photoCount: 4318,
    cover: [photo('4/3'), photo('1/1'), photo('3/4'), photo('4/3')],
    clusters: [
      { time: '07:40', label: 'Departure', count: 12 },
      { time: '10:15', label: 'Kenroku-en', count: 1428 },
      { time: '13:05', label: 'Lunch', count: 46 },
      { time: '14:30', label: 'Higashi Chaya', count: 1872 },
      { time: '18:50', label: 'Evening', count: 960 },
    ],
    note: 'Kenroku-en first thing was the right call. Took too many, so I will choose the keepers later at home.',
  },
  {
    kind: 'event',
    date: '2026-06-27',
    place: 'Kanazawa & Noto',
    today: false,
    title: 'Kanazawa & Noto, 4 days',
    start: '2026-06-24',
    end: '2026-06-27',
    photoCount: 16204,
    days: [
      { date: '2026-06-24', thumbs: 4, photoCount: 842, hasNote: true },
      { date: '2026-06-25', thumbs: 4, photoCount: 4318, hasNote: true },
      { date: '2026-06-26', thumbs: 4, photoCount: 8912, hasNote: false },
      { date: '2026-06-27', thumbs: 3, photoCount: 2132, hasNote: true },
    ],
    note: 'Finally made it to Noto, somewhere I had always wanted to go. Sorting the photos is homework.',
  },
]

/** Starred highlights (3c). */
export const highlights: HighlightsData = {
  total: 312,
  libraryTotal: 8214,
  months: [
    {
      yearMonth: '2026-08',
      count: 14,
      photos: [
        photo('4/3', { starred: true, caption: 'Below the lighthouse. Best of today.' }),
        photo('3/4', { starred: true }),
        photo('1/1', { starred: true, caption: 'Shaved-ice zenzai. Same again next year.' }),
        photo('4/3', { starred: true }),
        photo('1/1', { starred: true }),
        photo('4/3', { starred: true, caption: 'After the evening shower.' }),
        photo('3/4', { starred: true }),
        photo('4/3', { starred: true }),
      ],
    },
    {
      yearMonth: '2026-07',
      count: 4,
      photos: [
        photo('1/1', { starred: true }),
        photo('3/4', { starred: true, caption: 'Kenroku-en, first thing.' }),
        photo('4/3', { starred: true }),
        photo('4/3', { starred: true }),
      ],
    },
  ],
}

export const stats: LibraryStats = {
  usedBytes: 13_314_398_618, // 12.4 GB
  photoCount: 8214,
  dayCount: 486,
  starredCount: 312,
  location: '~/Library/Application Support/photo-diary/library',
  thumbnailCacheBytes: 671_088_640, // 640 MB
  // Raw ISO timestamp (as the Rust backend returns MAX(imported_at)); the UI formats it.
  lastImport: '2026-07-05T14:02:00',
}

export const folders: WatchedFolder[] = [
  {
    id: 'f1',
    path: '~/Pictures/iPhone Import',
    status: 'watching',
    // Raw ISO timestamp (as the Rust backend stores folders.last_scan); the UI formats it.
    lastScan: '2026-07-05T13:59:00',
    photoCount: 7842,
  },
  {
    id: 'f2',
    path: '/Volumes/SDCARD/DCIM',
    status: 'disconnected',
    lastScan: '2026-06-28T09:12:00',
    photoCount: 372,
  },
]

export const placeFacets: PlaceFacet[] = [
  { label: 'Shibuya', count: 132, selected: true },
  { label: 'Setagaya (home area)', count: 1204, selected: false },
  { label: 'Kyoto', count: 58, selected: false },
  { label: 'No location', count: 2410, selected: false, muted: true },
]

/**
 * Calendar month-grid records (July 2026) as the raw per-day shape the backend returns
 * — `buildMonthCells` derives the heat level from `count`, so no level is stored here.
 */
export const julyRecords: { day: number; count: number; hasNote: boolean }[] = [
  { day: 1, count: 0, hasNote: true }, // note but no photos
  { day: 2, count: 5, hasNote: false },
  { day: 4, count: 6, hasNote: true },
  { day: 5, count: 4, hasNote: true }, // today
]

/** 'YYYY-MM-DD' from local date parts (matches buildHeatWeeks' own local lookup). */
function isoDay(d: Date): string {
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Sample daily photo counts for the 2026 year heatmap (Jan 1 → today, 07-05). This is
 * mock sample data living where mock data belongs — `buildHeatWeeks` turns it into the
 * grid, so the mock and the real backend share the exact same derivation path.
 */
export const heatCounts: { date: string; count: number }[] = (() => {
  const pattern = [0, 2, 0, 5, 0, 0, 8, 1, 0, 3, 0, 12, 4, 0, 0, 6, 0, 2, 0, 9]
  const today = new Date(2026, 6, 5) // Jul 5, 2026 — the mock's "today"
  const out: { date: string; count: number }[] = []
  for (let idx = 0; ; idx++) {
    const d = new Date(2026, 0, 1 + idx)
    if (d > today) break
    const count = pattern[idx % pattern.length]
    if (count > 0) out.push({ date: isoDay(d), count })
  }
  return out
})()

/** The mock's fixed "today", shared by getMonth/getHeatmap. */
export const MOCK_TODAY = { year: 2026, month: 7, day: 5 } as const
export const MOCK_TODAY_ISO = '2026-07-05'
