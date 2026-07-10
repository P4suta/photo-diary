# Architecture

This document is the single reference point for the structure of photo-diary. It states "what" exists and "how it connects," while the rationale for "why it's this way" lives in thicker comments in the code (the seam in `src/domain/ports.ts`, the token definitions in `src/index.css`, and so on). Configuration prioritizes reproducibility, with local == CI as the principle (`just check` runs the same thing in both pre-push and CI).

photo-diary is a local desktop photo diary app aiming to sit "halfway between a photo album and a journal." It automatically creates a "day" from the capture time (EXIF), lays out today's photos in chronological order, lets you write just a few lines of note about the day, and lets you look back through a calendar + a yearly heatmap. Search is kept to date and place only. It does no AI or face recognition and isn't a photo backup service, but imported photos are kept permanently in the internal library (not the originals, but AVIF, full-resolution, visually lossless lightweight masters).

## Overall structure

Dependencies always point inward (domain ← data ← features; app / lib / ui cut across). The UI doesn't know the concrete backend and depends on the `PhotoLibrary` port only through TanStack Query (dependency inversion).

```
┌─────────────────────────────────────────────────────────────┐
│ src/features/  timeline / calendar / lightbox / highlights   │
│                library(settings) / import / onboarding /     │
│                tokens / shell  ← each feature encapsulates    │
│                                  UI + hooks                   │
│        │  useTimeline() / useSaveNote() … (TanStack Query)   │
│  ┌─────▼───────────────────────────────────────────────┐    │
│  │ src/app/  providers / router / queries / theme       │    │
│  │           ui-store / library-context                 │    │
│  │        useLibrary() → PhotoLibrary port (the seam)   │    │
│  └─────┬───────────────────────────────────────────────┘    │
└────────┼─────────────────────────────────────────────────────┘
         │ PhotoLibrary interface (the dependency-inversion face)
┌────────▼──────────────────┐        ┌──────────────────────────┐
│ src/data/mock/            │        │ (Phase 2)                 │
│  MockPhotoLibrary         │  ⇄ swap │  TauriPhotoLibrary        │
│  fixtures.ts              │        │  @tauri-apps/api invoke   │
└────────┬──────────────────┘        └──────────────────────────┘
         │ import / implements
┌────────▼─────────────────────────────────────────────────────┐
│ src/domain/  models.ts(DayEntry etc.) / ports.ts(PhotoLibrary) │
│              heatmap.ts / calendar.ts / tokens.ts             │
│              pure models & logic (React-free)                 │
└───────────────────────────────────────────────────────────────┘
```

`src/index.css` is the single source of truth for design tokens, referenced (via Tailwind) from any of the layers above.

## Layer responsibilities

Inner layers never import outer layers. `src/domain` depends on neither React nor UI, and `src/features` doesn't depend on the concrete backend.

- **`src/domain/`** — Pure models and logic. React-free; the JSON returned by Phase 2's Rust core is shaped to match these too.
  - `models.ts` — `Photo` / `DayEntry` (discriminated union, see below) / `TimeCluster` / `WatchedFolder` / `LibraryStats` / `HighlightsData` / `HighlightMonth` / `PlaceFacet` / `AspectRatio`.
  - `ports.ts` — The `PhotoLibrary` interface (the backend seam).
  - `heatmap.ts` — Yearly heatmap generation (`levelFor` / `buildHeatWeeks`). It uses a deterministic pseudo-random `seeded()`, so the output is identical every time (no `Math.random`).
  - `calendar.ts` — Month-grid cell generation (`buildMonthCells` → `MonthCell[]`).
  - `tokens.ts` — Design-token reference table (`tokenRows` / `tokenColor`). Values match the CSS variables in `index.css`.
- **`src/data/mock/`** — The concrete `PhotoLibrary` implementation. The only backend in Phase 1.
  - `MockPhotoLibrary.ts` — An in-memory `implements PhotoLibrary`.
  - `fixtures.ts` — Fixed data such as `timeline` / `highlights` / `stats` / `folders` / `placeFacets` / `julyRecords`.
- **`src/app/`** — App assembly. Depends on React but not on any specific feature screen.
  - `providers.tsx` — `QueryClientProvider` + `LibraryProvider`. `MockPhotoLibrary` is created once here.
  - `library-context.tsx` — `LibraryProvider` / `useLibrary()`. Hands the port to the UI (no dependency on the concrete class).
  - `queries.ts` — TanStack Query hooks (`useTimeline`, etc.) and the query keys `qk`.
  - `router.tsx` — react-router route definitions.
  - `theme.ts` — Theme state (Zustand). Reflects `.dark` and `data-accent` onto `<html>`.
  - `ui-store.ts` — Lightbox / import UI state (Zustand).
  - `App.tsx` — Just wraps `RouterProvider` in `Providers`.
- **`src/ui/`** — Small design-system primitives. `Button` / `Segmented` / `PhotoTile` / `icons` (SVGs ported from the design).
- **`src/features/`** — Units that encapsulate UI + hooks per feature. timeline / calendar / lightbox / library (settings) / highlights / import / onboarding / tokens / shell.
- **`src/lib/`** — Cross-cutting utilities. `cn.ts` (class merging) / `format.ts` (`formatCount` / `formatBytes` / `formatTakenAt`, etc.).
- **`src/index.css`** — The single source of truth for design tokens (`:root` / `.dark` / `[data-accent]` / heat variables). Tailwind references this.

## The seam: the PhotoLibrary port and adapters

The only face between UI and backend is `PhotoLibrary` in `src/domain/ports.ts`. The UI depends only on this interface and doesn't know the concrete class (`useLibrary()` in `src/app/library-context.tsx` returns the port type).

```ts
export interface PhotoLibrary {
  listTimeline(): Promise<DayEntry[]>      // chronological descending, today first
  getMonth(): Promise<MonthCell[]>         // calendar month grid
  getHeatmap(): Promise<HeatWeek[]>        // yearly heatmap
  getHighlights(): Promise<HighlightsData> // ★ highlights
  getStats(): Promise<LibraryStats>        // library stats
  listFolders(): Promise<WatchedFolder[]>  // watched-folder list
  listPlaceFacets(): Promise<PlaceFacet[]> // place facets for search
  saveNote(date: string, note: string): Promise<void> // save a day's note
  toggleStar(photoId: string): Promise<void>          // toggle a photo's ★
}
```

- **Phase 1 adapter**: `src/data/mock/MockPhotoLibrary.ts` (`implements PhotoLibrary`). It returns the fixed data from `fixtures.ts`, and `getMonth` / `getHeatmap` call `buildMonthCells` / `buildHeatWeeks` from `src/domain`. `saveNote` / `toggleStar` mutate in-memory objects directly.
- **Phase 2 adapter**: `TauriPhotoLibrary` (calls the Rust core via `@tauri-apps/api`'s `invoke`; not started). The only swap point is a single line in `src/app/providers.tsx`, and the UI is unchanged.

```tsx
// src/app/providers.tsx — the swap happens here, in one place
const [library] = useState(() => new MockPhotoLibrary())
// Phase 2: just change it to new TauriPhotoLibrary()
```

The concrete instance is injected into `LibraryProvider`, and from then on it's only obtained via `useLibrary()`. Because of this dependency inversion, swapping the backend implementation doesn't ripple into the UI.

## Data flow (TanStack Query)

Every read calls `PhotoLibrary` through a hook in `src/app/queries.ts`. The hook takes the port via `useLibrary()` and just passes a method to `useQuery`'s `queryFn`.

```
features component
  └─ useTimeline() / useCalendarMonth() / useHeatmap() / useHighlights()
     useStats() / useFolders() / usePlaceFacets()
        └─ useQuery({ queryKey: qk.*, queryFn: () => library.<method>() })
              └─ useLibrary() → PhotoLibrary → MockPhotoLibrary
```

- Query keys are consolidated in `qk` (`timeline` / `month` / `heatmap` / `highlights` / `stats` / `folders` / `placeFacets`).
- The `QueryClient` defaults to `staleTime: Infinity` and `refetchOnWindowFocus: false` (`src/app/providers.tsx`). Since the data is local, this avoids unnecessary refetches.
- **Mutations** are `useSaveNote` / `useToggleStar`. On success they invalidate the related queries (`saveNote` → `qk.timeline`, `toggleStar` → `qk.timeline` + `qk.highlights`).
- **Client UI state** (lightbox open/closed and current index, import overlay state) isn't server state, so it's held by Zustand's `useUi` (`src/app/ui-store.ts`) rather than TanStack Query. Theme (`mode` / `accent` / `showEmptyDays`) is likewise held by Zustand's `useTheme` (`src/app/theme.ts`).

## DayEntry — the discriminated union for a single day

A day in the timeline = one card is a discriminated union that distinguishes the capture/note state by `kind` (`src/domain/models.ts`). The card component renders each case via an exhaustive switch on `kind`.

```ts
export type DayEntry =
  | (DayCommon & { kind: 'photos'; photos: Photo[]; note: string | null })
  | (DayCommon & { kind: 'note_only'; note: string })
  | (DayCommon & { kind: 'empty' })
  | (DayCommon & {
      kind: 'digest'
      photoCount: number
      cover: Photo[]
      clusters: TimeCluster[]
      note: string | null
    })

export type DayKind = DayEntry['kind']
```

- The shared `DayCommon` holds `date` (`'YYYY-MM-DD'`) / `place` / `today`. Presentation (weekday, month-day, "N photos") is deliberately kept out of the domain — dates stay raw and the UI formats them per locale via `Intl` (`src/lib/datetime.ts`), so locale never crosses the `PhotoLibrary` port.
- `photos` = a normal day with photos, `note_only` = a note only with no photos, `empty` = no record, `digest` = the "digest" for a heavy-shooting day. `digest` holds a `TimeCluster[]` — auto-clustered by EXIF capture intervals — in `clusters`.
- Branching on `kind` lets each card handle only the fields it needs, type-safely. It's guaranteed by the type that `empty` has neither a note nor photos.

## The single source of truth for design tokens

The truth for colors and themes is consolidated in one place: the CSS variables in `src/index.css`. Everywhere else always references these.

- **Definitions**: `:root` (light) and `.dark` (dark) hold shadcn-compatible HSL triples (`--background` / `--foreground` / `--card` / `--muted` / `--border` / `--primary`, etc.). The accent is `--moss`. `[data-accent='dusk']` / `[data-accent='clay']` override `--moss` for light and dark respectively (the three accents moss / dusk / clay). The heatmap derives `--heat-1..4` from `--moss` via `color-mix`.
- **The connection to Tailwind**: `tailwind.config.ts` references these as `hsl(var(--…))` and turns them into utilities like `bg-background` / `text-foreground`. For heat, `src/features/calendar/heat.ts` statically enumerates literal classes such as `bg-[color:var(--heat-1)]` so Tailwind's scan picks them up.
- **Applying the theme**: `apply()` in `src/app/theme.ts` merely toggles the `.dark` class and the `data-accent` attribute on `<html>`, and the CSS side switches the values. `mode: 'system'` follows the OS `prefers-color-scheme`.
- **Reference table**: `tokenRows` in `src/domain/tokens.ts` is a table for the tokens screen (the token-list panel), and its values are kept in sync with the CSS variables in `index.css`. It's a copy for display; the truth is on the `index.css` side.

## The Phase 1 / Phase 2 boundary

- **Phase 1 (the current state of this repository = implemented)**: A Vite + React + TypeScript + Tailwind frontend. Data is mocked (`MockPhotoLibrary` + `fixtures.ts`). The calendar is fixed to July 2026, and the yearly heatmap is generated deterministically for 2026 (today = July 5).
- **Phase 2 (not started)**: A Tauri v2 shell + Rust core. EXIF reading via kamadak-exif, AVIF conversion via ravif / image, folder scanning via walkdir, and SQLite for the DB are envisioned. `TauriPhotoLibrary` implements `PhotoLibrary` and replaces `MockPhotoLibrary` (the UI is unchanged). Day detail (virtual scrolling, 2b) and multi-night events (2c) are also within Phase 2's scope.

Because the boundary is closed within a single interface (`PhotoLibrary`), Phase 2 work concentrates on adding an adapter and swapping `providers.tsx`, while `src/features` and `src/domain` can be used as-is.

## Directory map

```
src/
├─ domain/                 pure models & logic (React-free)
│  ├─ models.ts            Photo / DayEntry(discriminated union) / TimeCluster / WatchedFolder
│  │                       LibraryStats / HighlightsData / PlaceFacet / AspectRatio
│  ├─ ports.ts             PhotoLibrary interface (the backend seam)
│  ├─ heatmap.ts           levelFor / buildHeatWeeks (deterministic, seeded)
│  ├─ calendar.ts          buildMonthCells → MonthCell[]
│  └─ tokens.ts            tokenRows / tokenColor (reference table matching index.css)
├─ data/
│  └─ mock/                concrete PhotoLibrary (Phase 1)
│     ├─ MockPhotoLibrary.ts  implements PhotoLibrary (in-memory)
│     └─ fixtures.ts          timeline / highlights / stats / folders / placeFacets / julyRecords
├─ app/                    app assembly
│  ├─ providers.tsx        QueryClientProvider + LibraryProvider (concrete created here)
│  ├─ library-context.tsx  LibraryProvider / useLibrary()
│  ├─ queries.ts           TanStack Query hooks + qk
│  ├─ router.tsx           react-router route definitions
│  ├─ theme.ts             theme Zustand (reflects .dark / data-accent)
│  ├─ ui-store.ts          lightbox / import UI state Zustand
│  └─ App.tsx              Providers → RouterProvider
├─ ui/                     Button / Segmented / PhotoTile / icons
├─ features/               UI + hooks encapsulated per feature
│  ├─ shell/               AppShell / SearchBar / Sidebar / TopBar
│  ├─ timeline/            TimelineView / DayCard / DayHeader / DigestCard / NoteEditor
│  ├─ calendar/            CalendarView / MonthGrid / YearHeatmap / heat.ts
│  ├─ highlights/          HighlightsView
│  ├─ lightbox/            Lightbox
│  ├─ library/             SettingsView (settings)
│  ├─ import/              ImportOverlay
│  ├─ onboarding/          EmptyState (/welcome, when no folder is registered)
│  └─ tokens/              TokensView (token list)
├─ lib/                    cn.ts / format.ts
└─ index.css               the single source of truth for design tokens
```

## Routing

`src/app/router.tsx` (react-router) has `AppShell` as the parent, with `/` (TimelineView) / `/calendar` / `/highlights` / `/settings` / `/tokens` as child routes. The onboarding `/welcome` (EmptyState), shown when no folder is registered, sits on its own outside the shell.

## Build and quality gates

For reproducibility, local and CI pass through the same recipe (`just check`). The package manager is pnpm (npm is not used), and the toolchain is pinned by `mise.toml`.

- **Setup**: after `just setup`, run `just dev` (http://localhost:5173).
- **justfile recipes**: `setup` / `doctor` / `dev` / `typecheck` / `lint` / `fmt` / `typos` / `check` (= typecheck + lint + typos) / `build` / `clean`.
- **pnpm scripts**: `dev` / `build` / `preview` / `typecheck`.
- **Toolchain (`mise.toml`)**: node = lts, pnpm 10, biome 2.5.0, just 1, lefthook 2, crate-ci/typos, committed, taplo-cli. cargo goes via binstall.
- **Git gates (lefthook)**: commit-msg = committed (Conventional Commits) / pre-commit = biome (staged) + typos + `taplo fmt --check` / pre-push = `just check`.
- **CI (`.github/workflows/ci.yml`)**: jdx/mise-action → `pnpm install --frozen-lockfile` → `just check` → `just build`. Since pre-push and CI run the same `just check`, local == CI is preserved.

The design source (the Claude Design handoff `_handoff/`) and the internal memo `CLAUDE.md` are gitignored and reference-only.
