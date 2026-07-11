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
│ src/data/mock/            │        │ src/data/tauri/           │
│  MockPhotoLibrary         │ chosen │  TauriPhotoLibrary        │
│  fixtures.ts              │ ⇄ at   │  @tauri-apps/api invoke   │
│  (browser dev)            │ runtime│  → Rust core (Phase 2)    │
└────────┬──────────────────┘        └──────────┬───────────────┘
         │ implements                           │ implements
┌────────▼─────────────────────────────────────▼───────────────┐
│ src/domain/  models.ts(DayEntry etc.) / ports.ts(PhotoLibrary) │
│              calendar.ts / heatmap.ts (types) / build/*        │
│              heat-level.ts / star.ts / tokens.ts              │
│              pure models & logic (React-free)                 │
└───────────────────────────────────────────────────────────────┘
```

`src/app/providers.tsx` picks the implementation at runtime via `isTauri` (`src/app/env.ts`): `MockPhotoLibrary` in a browser, `TauriPhotoLibrary` inside the Tauri window. Both satisfy the same `PhotoLibrary` port, so the choice is invisible to the UI.

`src/index.css` is the single source of truth for design tokens, referenced (via Tailwind) from any of the layers above.

## Layer responsibilities

Inner layers never import outer layers. `src/domain` depends on neither React nor UI, and `src/features` doesn't depend on the concrete backend.

- **`src/domain/`** — Pure models and logic. React-free. The Rust core returns raw DTOs; the pure builders here (not Rust) assemble the port types.
  - `models.ts` — `Photo` / `DayEntry` (discriminated union, see below) / `TimeCluster` / `EventDay` / `WatchedFolder` / `LibraryStats` / `HighlightsData` / `HighlightMonth` / `PlaceFacet` / `ImportResult` / `ImportProgress` / `AspectRatio`.
  - `ports.ts` — The `PhotoLibrary` interface (the backend seam).
  - `calendar.ts` / `heatmap.ts` — **Type-only** now (`MonthCell`; `HeatWeek` / `HeatCell`). One shared shape for both backends and the UI.
  - `build/` — The pure builders that turn raw per-record data into port types: `buildTimeline` (day grouping, digest clustering, empty-gap fill), `buildMonthCells`, `buildHeatWeeks`, `groupHighlights`. Deterministic; used by **both** `MockPhotoLibrary` and `TauriPhotoLibrary`.
  - `heat-level.ts` — The single `count → level` bucket (shared by calendar dots and the heatmap). `star.ts` — starred-set helpers.
  - `tokens.ts` — Design-token reference table (`tokenRows` / `tokenColor`). Values match the CSS variables in `index.css`.
- **`src/data/mock/`** — The `PhotoLibrary` implementation used in browser dev.
  - `MockPhotoLibrary.ts` — An in-memory `implements PhotoLibrary` that feeds fixture records through the same `domain/build` functions.
  - `fixtures.ts` — Fixed data such as `timeline` / `highlights` / `stats` / `folders` / `placeFacets` / `julyRecords`.
- **`src/data/tauri/`** — The real backend (Phase 2).
  - `TauriPhotoLibrary.ts` — `implements PhotoLibrary` by calling `invoke`, mapping DTOs to `Photo`, and running the `domain/build` functions on the raw records.
  - `commands.ts` — Typed `invoke` wrappers + the DTO types (`PhotoDto` / `MonthRecordDto` / `DayCountDto` / …) matching the Rust core's `#[serde(rename_all = "camelCase")]` output.
- **`src/app/`** — App assembly. Depends on React but not on any specific feature screen.
  - `providers.tsx` — `QueryClientProvider` + `LibraryProvider`. Instantiates `TauriPhotoLibrary` or `MockPhotoLibrary` once, based on `isTauri`. The `QueryCache` surfaces failures as a toast.
  - `env.ts` — `isTauri` (detects the Tauri window).
  - `library-context.tsx` — `LibraryProvider` / `useLibrary()`. Hands the port to the UI (no dependency on the concrete class).
  - `queries.ts` — TanStack Query hooks (`useTimeline`, etc.), mutations, and the query keys `qk`.
  - `router.tsx` — react-router route definitions.
  - `theme.ts` — Theme state (Zustand). Reflects `.dark` and `data-accent` onto `<html>`.
  - `ui-store.ts` — Lightbox / import / toast UI state (Zustand).
  - `i18n.ts` — i18next init (en/ja). `App.tsx` — wraps `RouterProvider` in `Providers`.
- **`src/ui/`** — Small design-system primitives. `Button` / `Segmented` / `PhotoTile` / `ErrorPanel` / `icons` (SVGs ported from the design).
- **`src/features/`** — Units that encapsulate UI + hooks per feature. timeline / calendar / lightbox / library (settings) / highlights / import / onboarding / tokens / shell.
- **`src/lib/`** — Cross-cutting utilities. `cn.ts` (class merging) / `format.ts` (`formatCount` / `formatBytes`, etc.) / `datetime.ts` (locale-aware `Intl` day/time formatting).
- **`src/locales/`** — `en.json` / `ja.json` (i18next resources). Strings stay in the UI layer and never cross the port.
- **`src/index.css`** — The single source of truth for design tokens (`:root` / `.dark` / `[data-accent]` / heat variables). Tailwind references this.

## The seam: the PhotoLibrary port and adapters

The only face between UI and backend is `PhotoLibrary` in `src/domain/ports.ts`. The UI depends only on this interface and doesn't know the concrete class (`useLibrary()` in `src/app/library-context.tsx` returns the port type).

```ts
export interface PhotoLibrary {
  listTimeline(): Promise<DayEntry[]>              // reverse chronological, today first
  getMonth(year: number, month: number): Promise<MonthCell[]>  // calendar grid (1-based month)
  getHeatmap(year: number): Promise<HeatWeek[]>    // yearly heatmap for a year
  getHighlights(): Promise<HighlightsData>         // ★ highlights
  getStats(): Promise<LibraryStats>                // library stats
  listFolders(): Promise<WatchedFolder[]>          // watched-folder list
  listPlaceFacets(): Promise<PlaceFacet[]>         // place facets for search
  // mutations
  importFolder(path: string, onProgress?: (p: ImportProgress) => void): Promise<ImportResult>
  saveNote(date: string, note: string): Promise<void> // save (or, on empty, delete) a day's note
  toggleStar(photoId: string): Promise<void>          // toggle a photo's ★
}
```

`getMonth` / `getHeatmap` take an explicit year/month so the calendar and heatmap are no longer pinned to a fixed month — the query keys carry the parameters (`qk.month(year, month)`, `qk.heatmap(year)`).

- **Mock adapter**: `src/data/mock/MockPhotoLibrary.ts` (`implements PhotoLibrary`). It feeds `fixtures.ts` records through the same `domain/build` functions the real backend uses; `saveNote` / `toggleStar` upsert in-memory and return fresh objects so queries re-render.
- **Real adapter**: `src/data/tauri/TauriPhotoLibrary.ts`. Each method `invoke`s a Rust command, maps the DTOs, and runs the `domain/build` functions. `importFolder` streams per-file progress via a Tauri `Channel`; thumbnails and full-res masters resolve through `convertFileSrc`.

```tsx
// src/app/providers.tsx — the backend is chosen at runtime, not hand-swapped
const [library] = useState<PhotoLibrary>(() =>
  isTauri ? new TauriPhotoLibrary() : new MockPhotoLibrary(),
)
```

The concrete instance is injected into `LibraryProvider`, and from then on it's only obtained via `useLibrary()`. Because of this dependency inversion, which backend is running doesn't ripple into the UI.

## Data flow (TanStack Query)

Every read calls `PhotoLibrary` through a hook in `src/app/queries.ts`. The hook takes the port via `useLibrary()` and just passes a method to `useQuery`'s `queryFn`.

```
features component
  └─ useTimeline() / useCalendarMonth(year, month) / useHeatmap(year) / useHighlights()
     useStats() / useFolders() / usePlaceFacets()
        └─ useQuery({ queryKey: qk.*, queryFn: () => library.<method>() })
              └─ useLibrary() → PhotoLibrary → Mock- or TauriPhotoLibrary
```

- Query keys are consolidated in `qk` (`timeline` / `month` / `heatmap` / `highlights` / `stats` / `folders` / `placeFacets`). Parameterized keys append their args: `[...qk.month, year, month, today]`, `[...qk.heatmap, year, today]`.
- The `QueryClient` defaults to `staleTime: Infinity` and `refetchOnWindowFocus: false` (`src/app/providers.tsx`). Since the data is local, this avoids unnecessary refetches — so the current date is carried in the key via `useToday()` (`src/app/today.ts`), which rolls "today" over at midnight instead of leaving a diary opened overnight stuck on yesterday.
- **Mutations** (`src/app/queries.ts`): `useImportFolder` (invalidates everything — an import touches all reads), `useSaveNote` (→ `timeline` + `month` + `stats`), `useToggleStar` (optimistic in-place flip across `timeline` + `highlights` with rollback on error, then settles by invalidating `timeline` + `highlights` + `stats`).
- **Client UI state** (lightbox open/closed and current index, import overlay, toasts) isn't server state, so it's held by Zustand's `useUi` (`src/app/ui-store.ts`) rather than TanStack Query. Theme (`mode` / `accent` / `showEmptyDays`) is likewise held by Zustand's `useTheme` (`src/app/theme.ts`).

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
  | (DayCommon & {
      kind: 'event'
      title: string
      start: string  // inclusive 'YYYY-MM-DD' span
      end: string
      photoCount: number
      days: EventDay[]
      note: string | null
    })

export type DayKind = DayEntry['kind']
```

- The shared `DayCommon` holds `date` (`'YYYY-MM-DD'`) / `place` / `today`. Presentation (weekday, month-day, "N photos") is deliberately kept out of the domain — dates stay raw and the UI formats them per locale via `Intl` (`src/lib/datetime.ts`), so locale never crosses the `PhotoLibrary` port.
- `photos` = a normal day with photos, `note_only` = a note only with no photos, `empty` = no record, `digest` = the "digest" for a heavy-shooting day (holds EXIF-clustered `TimeCluster[]`), `event` = a multi-night trip spanning several days. **Five variants.**
- `event` currently renders only from mock fixtures (`EventCard`); the Rust-fed `buildTimeline` does not yet emit `kind: 'event'` (2c has no backend grouping). The variant and card exist so the switch stays exhaustive.
- Branching on `kind` lets each card handle only the fields it needs, type-safely (`strict` + `noFallthroughCasesInSwitch` catch a missed variant). It's guaranteed by the type that `empty` has neither a note nor photos.

## The single source of truth for design tokens

The truth for colors and themes is consolidated in one place: the CSS variables in `src/index.css`. Everywhere else always references these.

- **Definitions**: `:root` (light) and `.dark` (dark) hold shadcn-compatible HSL triples (`--background` / `--foreground` / `--card` / `--muted` / `--border` / `--primary`, etc.). The accent is `--moss`. `[data-accent='dusk']` / `[data-accent='clay']` override `--moss` for light and dark respectively (the three accents moss / dusk / clay). The heatmap derives `--heat-1..4` from `--moss` via `color-mix`.
- **The connection to Tailwind**: `tailwind.config.ts` references these as `hsl(var(--…))` and turns them into utilities like `bg-background` / `text-foreground`. For heat, `src/features/calendar/heat.ts` statically enumerates literal classes such as `bg-[color:var(--heat-1)]` so Tailwind's scan picks them up.
- **Applying the theme**: `apply()` in `src/app/theme.ts` merely toggles the `.dark` class and the `data-accent` attribute on `<html>`, and the CSS side switches the values. `mode: 'system'` follows the OS `prefers-color-scheme`.
- **Reference table**: `tokenRows` in `src/domain/tokens.ts` is a table for the tokens screen (the token-list panel), and its values are kept in sync with the CSS variables in `index.css`. It's a copy for display; the truth is on the `index.css` side.

## The Phase 1 / Phase 2 boundary

- **Phase 1 — implemented**: A Vite + React + TypeScript + Tailwind frontend. In browser dev the data is mocked (`MockPhotoLibrary` + `fixtures.ts`, keyed around a July 2026 fixture set).
- **Phase 2 — implemented**: A Tauri v2 shell + a Rust core (`crates/photo-diary-core`): EXIF via kamadak-exif, orientation correction, full-res visually-lossless AVIF via `image`'s AvifEncoder, folder scan via walkdir, SQLite (rusqlite) with `user_version` migrations, SHA-256 dedup, an async import pipeline with per-file error reporting, and a read-query layer returning raw DTOs. `TauriPhotoLibrary` (`src/data/tauri/`) implements the same `PhotoLibrary`; `providers.tsx` selects it at runtime inside the Tauri window. The UI is unchanged.
  - The Rust side returns **raw records** (`PhotoDto`, `MonthRecordDto`, `DayCountDto`, notes, …); day grouping, digest clustering, the calendar grid, the heatmap and highlights are assembled in TS (`src/domain/build/*`), shared with the mock.
  - Day detail (virtual scrolling, 2b) and multi-night events (2c) are within Phase 2's scope but only partly built: `DayDetailView` is a static mock kept unrouted, and `event` cards render only from fixtures (no backend event grouping yet).

Because the boundary is closed within a single interface (`PhotoLibrary`), both backends plug in behind the same port and `src/features` / most of `src/domain` are used as-is.

## Directory map

```
src/
├─ domain/                 pure models & logic (React-free)
│  ├─ models.ts            Photo / DayEntry(5-variant union) / TimeCluster / EventDay
│  │                       WatchedFolder / LibraryStats / HighlightsData / PlaceFacet
│  │                       ImportResult / ImportProgress / AspectRatio
│  ├─ ports.ts             PhotoLibrary interface (the backend seam)
│  ├─ calendar.ts          MonthCell type (builder lives in build/)
│  ├─ heatmap.ts           HeatWeek / HeatCell types (builder lives in build/)
│  ├─ build/               pure builders shared by both backends
│  │  ├─ timeline.ts       buildTimeline (grouping / digest / empty-gap)
│  │  ├─ calendar.ts       buildMonthCells → MonthCell[]
│  │  ├─ heatmap.ts        buildHeatWeeks → HeatWeek[]
│  │  └─ highlights.ts     groupHighlights → HighlightsData
│  ├─ heat-level.ts        count → level bucket (calendar dots + heatmap)
│  ├─ star.ts              starred-set flip helpers (optimistic updates)
│  └─ tokens.ts            tokenRows / tokenColor (reference table matching index.css)
├─ data/
│  ├─ mock/                PhotoLibrary for browser dev
│  │  ├─ MockPhotoLibrary.ts  implements PhotoLibrary (in-memory, via build/)
│  │  └─ fixtures.ts          timeline / highlights / stats / folders / placeFacets / julyRecords
│  └─ tauri/               the real backend (Phase 2)
│     ├─ TauriPhotoLibrary.ts implements PhotoLibrary over invoke (+ build/)
│     └─ commands.ts          typed invoke wrappers + DTO types (camelCase)
├─ app/                    app assembly
│  ├─ providers.tsx        QueryClientProvider + LibraryProvider (isTauri picks backend)
│  ├─ env.ts               isTauri
│  ├─ library-context.tsx  LibraryProvider / useLibrary()
│  ├─ queries.ts           TanStack Query hooks + mutations + qk
│  ├─ today.ts             useToday (rolls "today" over at midnight)
│  ├─ router.tsx           react-router route definitions
│  ├─ theme.ts             theme Zustand (reflects .dark / data-accent)
│  ├─ ui-store.ts          lightbox / import / toast UI state Zustand
│  ├─ i18n.ts              i18next init (en/ja)
│  └─ App.tsx              Providers → RouterProvider
├─ ui/                     Button / Segmented / PhotoTile / ErrorPanel / icons
├─ features/               UI + hooks encapsulated per feature
│  ├─ shell/               AppShell / SearchBar / Sidebar / TopBar / Toast
│  ├─ timeline/            TimelineView / DayCard / DayHeader / DigestCard / EventCard
│  │                       NoteEditor / DayDetailView (2b, unrouted mock)
│  ├─ calendar/            CalendarView / MonthGrid / YearHeatmap / heat.ts
│  ├─ highlights/          HighlightsView
│  ├─ lightbox/            Lightbox
│  ├─ library/             SettingsView (settings)
│  ├─ import/              ImportOverlay
│  ├─ onboarding/          EmptyState (/welcome, when no folder is registered)
│  └─ tokens/              TokensView (token list)
├─ lib/                    cn.ts / format.ts / datetime.ts
├─ locales/                en.json / ja.json (i18next)
├─ test/                   vitest setup / polyfills / port-contract suite / utils
└─ index.css               the single source of truth for design tokens

crates/photo-diary-core/   Rust core: scan / exif / orient / transcode / thumbnail
                           db (SQLite + migrations) / views (read queries) / dto / library
src-tauri/                 Tauri v2 shell: IPC commands → photo-diary-core, tauri.conf.json (CSP)
e2e/                       Playwright smoke spec + global-setup
```

## Routing

`src/app/router.tsx` (react-router) has `AppShell` as the parent, with `/` (TimelineView) / `/calendar` / `/highlights` / `/settings` / `/tokens` as child routes. The onboarding `/welcome` (EmptyState), shown when no folder is registered, sits on its own outside the shell. The 2b day-detail screen (`DayDetailView`) is intentionally **not** routed — it's still a static mock and stays unreachable until it's wired from real data as `/day/:date`.

## Build and quality gates

For reproducibility, local and CI pass through the same recipe (`just check`). The package manager is pnpm (npm is not used), and the toolchain is pinned by `mise.toml`.

- **Setup**: after `just setup`, run `just dev` (http://localhost:5173).
- **justfile recipes**: `setup` / `doctor` / `dev` / `typecheck` / `lint` / `fmt` / `typos` / `test` / `coverage` / `check` (= typecheck + lint + typos + coverage) / `e2e` / `verify` (= check + build + e2e) / `build` / `clean`. Desktop (Phase 2): `app-dev` / `app-build` / `app-test` / `app-lint` / `check-rust` (= app-test + app-lint).
- **pnpm scripts**: `dev` / `build` / `preview` / `typecheck` / `test` / `coverage` / `e2e` / `tauri`.
- **Toolchain (`mise.toml`, all exact-pinned)**: node 24.18.0, pnpm 10.34.4, biome 2.5.0, rust 1.96.0, just 1.54.0, lefthook 2.1.9, crate-ci/typos 1.47.2, committed 1.1.11, taplo-cli 0.10.0. cargo-backend tools are binstalled. Rust for the Phase 2 core/shell is provisioned by mise too (`rust = "1.96.0"`), so local == CI on the Rust side as well.
- **Git gates (lefthook)**: commit-msg = committed (Conventional Commits) / pre-commit = biome (staged) + typos + `taplo fmt --check` / pre-push = `just check`, plus `just check-rust` when the push includes Rust files (`*.rs` / `Cargo.*`).
- **CI (`.github/workflows/ci.yml`)** — three jobs: `check` (jdx/mise-action → `pnpm install --frozen-lockfile` → `just check` → `just build`, pnpm-store cached), `e2e` (installs the Playwright browser, runs `just e2e`), and `rust` (Linux + Windows matrix; installs Tauri's Linux system deps, caches cargo, runs `just check-rust`). Since pre-push and CI run the same recipes, local == CI is preserved.

The design source (the Claude Design handoff `_handoff/`) and the internal memo `CLAUDE.md` are gitignored and reference-only.
