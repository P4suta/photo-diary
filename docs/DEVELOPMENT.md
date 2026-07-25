# Development guide

A shared handbook for anyone touching photo-diary. It collects the "invariants you must not break" and pointers to the canonical files where their rationale lives. When this text and the actual files disagree, **the actual files (mise.toml / justfile / lefthook.yml / .github/workflows/ci.yml) win** — file an issue to fix this page.

photo-diary is a local desktop photo diary app aiming to sit "halfway between a photo album and a journal." It automatically creates a "day" from the capture time (EXIF), lays out today's photos in chronological order, lets you write just a few lines of note about the day, and lets you look back through a calendar and a yearly heatmap.

## Reading order to start

1. **This guide** — the fixed rules and the things it deliberately won't do (non-goals).
2. **[ARCHITECTURE](ARCHITECTURE.md)** — dependency direction, the `PhotoLibrary` port seam, and how the feature slices are split.
3. The primary source in the code — `mise.toml` (tools), `justfile` (tasks), `lefthook.yml` (hooks), `.github/workflows/ci.yml` (CI). If any of these contradict the above, these win.

## Current phase and non-goals

photo-diary v0.1 has one end-to-end architecture. The React frontend uses a browser mock during UI development and the Tauri adapter in the Windows app. Day detail, event grouping, search, live folder updates and Settings actions all cross the same `PhotoLibrary` seam.

What it deliberately won't do (non-goals):

> AI · face recognition · a photo backup service · cloud sync of the originals.

photo-diary **keeps** the photos you take permanently in an internal library, but not the originals — they're AVIF, full-resolution, visually lossless lightweight masters. Search stays limited to date and place. Before adding a new feature, check that it doesn't fatten the "halfway between a photo album and a journal" concept. Endless feature accretion is a non-goal.

## Fixed architectural rules

Even if it compiles, breaking these is a regression. Dependencies point **inward only** (outer layers know inner ones; inner layers don't know outer ones).

- **Dependency direction.** `src/ui` / `src/features` → `src/app` (TanStack Query hooks) → `src/domain/ports.ts` (the `PhotoLibrary` interface) ← `src/data/mock` + `src/data/tauri` (both implement it). The UI doesn't touch the concrete backend directly — it depends **only through the `PhotoLibrary` port** (dependency inversion). This is the seam that lets the mock and the real Rust backend coexist behind one interface.
- **Keep `src/domain/` pure.** `models.ts` (the `DayEntry` discriminated union, `Photo`, `TimeCluster`, etc.), `ports.ts`, `calendar.ts` / `heatmap.ts` (types), `build/*`, `heat-level.ts`, `star.ts`, `tokens.ts` depend on neither React nor UI. The only `import`s allowed here are modules within the same `domain/`. **The Rust core returns raw DTOs, not port shapes** — day grouping, the calendar grid, the heatmap and highlights are assembled by the pure builders in `src/domain/build/`, which both `MockPhotoLibrary` and `TauriPhotoLibrary` run. Only `Photo` maps roughly 1:1 from a DTO.
- **`PhotoLibrary` is the one seam.** Consolidate all backend interaction into the single interface in `src/domain/ports.ts`. Don't call `fetch`/`invoke` directly from a hook or component, or `new` up a library outside `providers.tsx`. Obtaining the library goes only through `useLibrary()` (`src/app/library-context.tsx`).
- **Server state is TanStack Query, UI state is Zustand.** Confine data fetching, caching, and mutations to the hooks in `src/app/queries.ts` (`useTimeline` / `useCalendarMonth` / `useHeatmap` / `useHighlights` / `useStats` / `useFolders` / `usePlaceFacets` / `useImportFolder` / `useSaveNote` / `useToggleStar`). Query keys are managed centrally by `qk` in the same file (parameterized keys append their args, e.g. `[...qk.month, year, month, today]`). Theme lives in `src/app/theme.ts`, and other UI state in `src/app/ui-store.ts` (both Zustand).
- **The single source of truth for design tokens is `src/index.css`.** `:root` / `.dark` / `[data-accent]` / heat variables live there. `tailwind.config.ts` just bridges those CSS variables into Tailwind — don't hardcode colors into components. The accent is `--moss` (moss / dusk / clay), with both light and dark supported. The typeface is Noto Sans JP, self-hosted via `@fontsource-variable/noto-sans-jp` (no runtime Google Fonts).
- **`DayEntry` must always be rendered via an exhaustive switch.** `kind` is the five-variant discriminated union `'photos' | 'note_only' | 'empty' | 'digest' | 'event'`. The card side branches exhaustively on `kind` (`strict` + `noFallthroughCasesInSwitch` in `tsconfig.app.json` catch omissions).

## Toolchain & shell promises

- **Tools are pinned in `mise.toml`, all exact.** node (24.18.0), pnpm (10.34.4), biome (2.5.0), rust (1.96.0), just (1.54.0), lefthook (2.1.9), `github:crate-ci/typos` (1.47.2), `cargo:committed` (1.1.11), `cargo:taplo-cli` (0.10.0), and `pipx:reuse` (6.2.0) are declared. Don't hand-install project tools; add them to `mise.toml` and run `mise install`.
- **`just` is the only entry point.** Route dev / build work through justfile recipes. Don't invoke raw `pnpm` / `biome` / `git` directly in routines — add a recipe. That keeps the bundling/gating logic in one place. Right after `just setup`, run `just doctor` to confirm the environment matches the pins.
- **The package manager is pnpm.** `npm` is not used (`package.json`'s `packageManager`: `pnpm@10.34.4`). The content-addressed store and strict `node_modules` are the reasons. CI uses `pnpm install --frozen-lockfile`, so always commit `pnpm-lock.yaml` when you change dependencies.
- **Don't write shell-specific syntax into justfile / lefthook.** The justfile declares `set windows-shell := ["powershell.exe", "-NoProfile", "-Command"]` on Windows. Don't chain multiple steps with `&&`; split them into recipe lines (or hook jobs). For ad hoc one-offs use PowerShell (this repo's primary shell), and Git Bash only when POSIX is genuinely required.

## Tasks (just recipes)

`just` (no arguments) prints a menu by area. Use these recipe names exactly.

| Recipe | What it runs | When |
|---|---|---|
| `just setup` | `mise install` → `lefthook install` → `pnpm install` | first time, once |
| `just doctor` | `mise doctor` + `mise ls --current` | right after `setup`, to confirm the pins |
| `just dev` | `pnpm dev` (Vite: `http://localhost:5173`) | development loop |
| `just typecheck` | `pnpm typecheck` (`tsc -b --noEmit`) | fast inner loop |
| `just lint` | `biome check .` | same binary+version as hook/CI |
| `just fmt` | `biome check --write .` → `taplo fmt` | auto-format (TS/TSX/JSON → TOML) |
| `just typos` | `typos` | spell-check the sources |
| `just test` / `test-watch` | `vitest run` / `vitest` | unit / component / contract / a11y |
| `just coverage` | `vitest run --coverage` | tests + V8 coverage (thresholds on domain/lib) |
| `just reuse` | `reuse lint` | REUSE 3.3 copyright/license metadata |
| `just check` | `typecheck` + `lint` + `typos` + `reuse` + `coverage` | the full local gate (identical to CI) |
| `just e2e` | `playwright test` | end-to-end (browser); not part of `check` |
| `just verify` | `check` + `build` + `e2e` | full local acceptance |
| `just build` | `pnpm build` (`tsc -b && vite build`) | production build |
| `just clean` | remove `dist` and `node_modules/.vite` | node_modules is kept |
| `just app-dev` / `app-build` | `pnpm tauri dev` / `build` | run / package the Windows desktop app |
| `just app-test` / `app-lint` | `cargo test --workspace` / clippy + `fmt --check` | Rust core + shell |
| `just check-rust` | `app-test` + `app-lint` | the full Rust-side gate |
| `just native-e2e` | feature-isolated Tauri build + WDIO | Windows real SQLite/IPC acceptance |
| `just mutation` / `mutation-rust` | StrykerJS (TS domain/lib) / cargo-mutants (Rust core), whole repo | mutation baseline (manual, heavy) |
| `just mutation-diff` / `mutation-rust-diff` | the same, but only what changed vs a base ref | the PR-diff mutation gate |

The pnpm scripts (`package.json`) include `dev` / `build` / `preview` / `typecheck` / `test` / `coverage` / `e2e` / `native-e2e` / `tauri`. The justfile wraps these. Day to day, use `just` rather than raw pnpm. First browser E2E run locally needs Chromium once: `pnpm exec playwright install chromium`. Windows native E2E follows Tauri's WebdriverIO approach and uses the feature-isolated test build from `just native-e2e`.

## Quality gates (hooks / CI)

The gates share one definition between local and CI. The hooks are managed by lefthook and installed by the `lefthook install` in `just setup`.

- **commit-msg** — `committed --commit-file {1}`. Enforces Conventional Commits and tidies the history toward future release automation. `committed` skips `fixup!` / merge commits, so autosquash rebases pass as-is. Config is `committed.toml`.
- **pre-commit** (parallel) — 3 jobs:
  - `biome check --no-errors-on-unmatched {staged_files}` — staged TS/TSX/JS/JSON only (fast).
  - `typos` — spell-check the whole working tree (config `_typos.toml`).
  - `taplo fmt --check` — check that staged `*.toml` are formatted (config `taplo.toml`).
- **pre-push** — `just check` (= typecheck + Biome + typos + coverage). Plus `rust-gate`: `just check-rust`, glob-filtered so it only runs when the push touches `*.rs` / `Cargo.*` (a JS-only push skips it).
- **CI** (`.github/workflows/ci.yml`, `push: [main]` and all PRs) — **check** includes REUSE 3.3, **e2e** runs Playwright, **rust** runs Linux + Windows gates, **native-e2e** drives the feature-isolated Tauri binary with embedded WDIO on Windows, and **mutation** checks changed pure logic.

Because the hooks and CI run the same recipes, `--no-verify` only defers a failure to CI.

### Mutation testing (the fourth gate)

Coverage proves a line *ran*; mutation testing proves a test would *fail* if that line were wrong. StrykerJS mutates the TS pure-logic layers (`src/domain` / `src/lib`, via `vitest.stryker.config.ts` + `stryker.config.json`), and cargo-mutants mutates the Rust core crate (`.cargo/mutants.toml`) — the same pure layers that carry the 90% coverage thresholds.

- **PR-diff scope.** The CI `mutation` job only mutates what the PR touched (Stryker via a node driver that lists changed `domain`/`lib` files for `--mutate`; cargo-mutants via `--in-diff`). It enforces the *new* change without demanding you first clear the whole existing backlog — the same "enforce on the diff" spirit as the coverage gate.
- **The two sides gate differently.** Stryker uses a percentage `break` threshold (`thresholds.break`); cargo-mutants has **no percentage** — a single surviving mutant exits non-zero. Mind the asymmetry when reading failures.
- **A whole-file caveat (TS).** Stryker has no line-level diff filter, so `--mutate <changed file>` re-mutates the *entire* file — a one-line edit to a big well-tested file can surface a pre-existing survivor. `incremental` (cached in CI) reuses unchanged mutants to soften this; cargo-mutants is line-scoped and doesn't have the issue.
- **Baselines & thresholds (measured).** TS full baseline is **87.3%** (StrykerJS over domain/lib; lowest files are `domain/tokens.ts` 75% and `build/timeline.ts` 80%). `stryker.config.json` sets `break: 70` — under the lowest file so touching existing code doesn't spuriously fail, while still catching a genuinely weak change. **The TS diff gate is enforced.**
- **Rust needs single-threaded mutation tests.** cargo-mutants runs with `--test-threads=1` (`.cargo/mutants.toml`) because the db migration tests can otherwise contend under cargo-mutants' isolated target dir; `cargo test --workspace` itself stays parallel and green. The Rust diff gate is enforced: any surviving changed mutant exits non-zero and fails CI.

## Editor

`.vscode/extensions.json` proposes recommended extensions (Extensions: Show Recommended Extensions):

- **biomejs.biome** — lint + format for TS/TSX/JSON (matches `just lint` / `just fmt`).
- **bradlc.vscode-tailwindcss** — Tailwind IntelliSense aligned with the token bridge in `tailwind.config.ts`.
- **tamasfe.even-better-toml** — TOML editing for `mise.toml` and others (matches taplo).
- **skellock.just** — syntax highlighting for the justfile (setup/dev/check/build recipes).

In any editor, the canonical formatters/linters are Biome (TS/TSX/JSON), taplo (TOML), and typos. When in doubt, don't format by hand — run `just fmt`. Confirm the toolchain matches the pins with `just doctor`.

## How to add a new feature (feature slice + through the port)

A feature encapsulates UI and hooks under `src/features/<name>/` (existing: `timeline`, `calendar`, `lightbox`, `library`, `highlights`, `import`, `onboarding`, `tokens`, `shell`). Add new features along this seam:

1. **Domain first.** Add the types you need to `src/domain/models.ts` (React-free). If the data needs shaping from raw records, put that pure logic in a `src/domain/build/` function (the existing builders are the models to follow) so both backends share it.
2. **Widen the port.** If you need data, add one read (`Promise<T>`) or mutation method to `PhotoLibrary` in `src/domain/ports.ts`.
3. **Implement *both* backends.** The port has two implementations, so add the method to each:
   - `src/data/mock/MockPhotoLibrary.ts` (+ any fixed values in `src/data/mock/fixtures.ts`) — keeps browser dev working.
   - `src/data/tauri/TauriPhotoLibrary.ts` (+ a typed wrapper in `commands.ts`) — and add the matching `#[tauri::command]` in `src-tauri/src/lib.rs` returning a raw DTO (`#[serde(rename_all = "camelCase")]`), plus any read query in `crates/photo-diary-core`. Run the raw records through the same `domain/build` function the mock uses.
4. **One query hook.** Add a `qk` key and a `useXxx()` hook to `src/app/queries.ts` (fetch with `useQuery`, update with `useMutation` + `invalidateQueries` on the related keys). The hook just takes the port from `useLibrary()` and never touches a concrete class.
5. **UI in a feature slice.** Put the component under `src/features/<name>/` and have it call only the hook above. Shared look-and-feel parts go in `src/ui/` (`Button` / `Segmented` / `PhotoTile` / `icons`), small helpers in `src/lib/` (`cn.ts` / `format.ts` / `datetime.ts`). Colors always go through the tokens in `src/index.css`; user-facing strings go through i18next (`src/locales/`).
6. **Wire the route.** For a screen, add a route to `src/app/router.tsx`.

**Don't:** call `fetch`/`invoke` directly from a component / `new` up a library outside `providers.tsx` / import React into `domain/` / assemble port shapes in Rust instead of `domain/build` / hardcode colors without going through tokens.

## Where the mock data lives

- `src/data/mock/MockPhotoLibrary.ts` — the in-memory `PhotoLibrary` used in browser dev.
- `src/data/mock/fixtures.ts` — the fixed values (`timeline`, `julyRecords`, `highlights`, `stats`, `folders`, `placeFacets`). The mock fixtures are built around July 2026; the month cells and heatmap are assembled from raw records by the shared builders in `src/domain/build/` (`buildMonthCells` / `buildHeatWeeks`) — the same functions the real backend uses.

`providers.tsx` news up exactly one library — `TauriPhotoLibrary` inside the desktop window, `MockPhotoLibrary` otherwise (`isTauri`) — and hands it to all UI from `LibraryProvider`. That one place is where the backend is chosen.

## How the two backends plug in

The Tauri v2 shell and Rust core plug in without rewriting `src/ui` / `src/features` / `src/domain`. Follow this shape when extending the backend:

1. **The Rust core** (`crates/photo-diary-core/`): `kamadak-exif` for EXIF (+ orientation correction), `image`'s `AvifEncoder` for full-res visually-lossless AVIF masters, pure-Rust `zenavif` only for rebuilding thumbnails from those internal masters, `walkdir` for scanning, `rusqlite` (SQLite, `user_version` migrations) for metadata, and `sha2` for folder dedup. Import is async with per-file error reporting; HEIC/HEIF/AVIF remain skipped as unsupported inputs. Imported photos are kept permanently as lightweight masters under the app's local data dir.
2. **Raw DTOs, not port shapes.** The Rust commands return raw records (`PhotoDto`, `MonthRecordDto`, `DayCountDto`, notes, folders, stats) with `#[serde(rename_all = "camelCase")]`. **The `DayEntry` grouping, calendar grid, heatmap and highlights are assembled in TS** by `src/domain/build/*` — not on the Rust side. Only `Photo` maps ~1:1 from a DTO. The port is the contract; the builders are shared with the mock so both backends agree.
3. **`TauriPhotoLibrary`** (`src/data/tauri/`): implements `PhotoLibrary` by `invoke`ing commands (`commands.ts` holds the typed wrappers + DTO types), mapping DTOs to `Photo` (thumbnails/masters via `convertFileSrc`), and running the `domain/build` functions.
4. **Runtime selection.** `providers.tsx` picks `TauriPhotoLibrary` or `MockPhotoLibrary` via `isTauri` — **the UI is unchanged**.
5. **Gates.** `mise.toml` pins Rust; the justfile has `app-*` / `check-rust`; the pre-push `rust-gate` and the CI `rust` matrix run `just check-rust`; `taplo` formats the Cargo TOML. Keep new Rust recipes/CI steps here.

Day detail uses 120-photo cursor pages with fixed-row virtualization. Multi-night events are derived from bounded day records in `domain/build/timeline.ts`, while exact or unambiguous span metadata is persisted through the Rust core.
