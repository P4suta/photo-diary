# Development guide

A shared handbook for anyone touching photo-diary. It collects the "invariants you must not break" and pointers to the canonical files where their rationale lives. When this text and the actual files disagree, **the actual files (mise.toml / justfile / lefthook.yml / .github/workflows/ci.yml) win** — file an issue to fix this page.

photo-diary is a local desktop photo diary app aiming to sit "halfway between a photo album and a journal." It automatically creates a "day" from the capture time (EXIF), lays out today's photos in chronological order, lets you write just a few lines of note about the day, and lets you look back through a calendar and a yearly heatmap.

## Reading order to start

1. **This guide** — the fixed rules and the things it deliberately won't do (non-goals).
2. **[ARCHITECTURE](ARCHITECTURE.md)** — dependency direction, the `PhotoLibrary` port seam, and how the feature slices are split.
3. The primary source in the code — `mise.toml` (tools), `justfile` (tasks), `lefthook.yml` (hooks), `.github/workflows/ci.yml` (CI). If any of these contradict the above, these win.

## Current phase and non-goals

photo-diary proceeds in 2 phases; **both are now implemented.** The seam between them is what you must not break.

- **Phase 1 — implemented.** The React / TypeScript / Vite / Tailwind frontend. In browser dev (`http://localhost:5173`) the data is mocked (`src/data/mock/`) and every screen works.
- **Phase 2 — implemented.** A Tauri v2 shell (`src-tauri/`) and a Rust core (`crates/photo-diary-core/`) are in place, and `TauriPhotoLibrary` (`src/data/tauri/`) implements the same port. `providers.tsx` chooses the backend at **runtime** via `isTauri` — mock in the browser, Rust core inside the desktop window — so the UI never changed (see "How the two backends plug in" below). Still partial: day detail (2b) is an unrouted mock, and multi-night events (2c) have types/cards but no backend grouping.

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

- **Tools are pinned in `mise.toml`, all exact.** node (24.18.0), pnpm (10.34.4), biome (2.5.0), rust (1.96.0), just (1.54.0), lefthook (2.1.9), `github:crate-ci/typos` (1.47.2), `cargo:committed` (1.1.11), `cargo:taplo-cli` (0.10.0) are declared — no floating majors or `lts`, so local and CI resolve byte-identical versions. **Rust for the Phase 2 core/shell is provisioned by mise too** (`rust = "1.96.0"`); don't `rustup`/`winget`/hand-install it — add tools to `mise.toml` and run `mise install` (or `just setup`). `cargo.binstall = true` under `[settings]` makes cargo-backend tools fetch prebuilt binaries rather than compiling from source (fast on both local and CI).
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
| `just check` | `typecheck` + `lint` + `typos` + `coverage` | the full local gate (identical to CI) |
| `just e2e` | `playwright test` | end-to-end (browser); not part of `check` |
| `just verify` | `check` + `build` + `e2e` | full local acceptance |
| `just build` | `pnpm build` (`tsc -b && vite build`) | production build |
| `just clean` | remove `dist` and `node_modules/.vite` | node_modules is kept |
| `just app-dev` / `app-build` | `pnpm tauri dev` / `build` | run / package the desktop app (Phase 2) |
| `just app-test` / `app-lint` | `cargo test --workspace` / clippy + `fmt --check` | Rust core + shell |
| `just check-rust` | `app-test` + `app-lint` | the full Rust-side gate |
| `just mutation` / `mutation-rust` | StrykerJS (TS domain/lib) / cargo-mutants (Rust core), whole repo | mutation baseline (manual, heavy) |
| `just mutation-diff` / `mutation-rust-diff` | the same, but only what changed vs a base ref | the PR-diff mutation gate |

The pnpm scripts (`package.json`) are `dev` / `build` / `preview` / `typecheck` / `test` / `coverage` / `e2e` / `tauri`. The justfile wraps these. Day to day, use `just` rather than raw pnpm. First E2E run locally needs the browser once: `pnpm exec playwright install chromium`.

## Quality gates (hooks / CI)

The gates share one definition between local and CI (local == CI). The hooks are managed by lefthook and installed by the `lefthook install` in `just setup`.

- **commit-msg** — `committed --commit-file {1}`. Enforces Conventional Commits and tidies the history toward future release automation. `committed` skips `fixup!` / merge commits, so autosquash rebases pass as-is. Config is `committed.toml`.
- **pre-commit** (parallel) — 3 jobs:
  - `biome check --no-errors-on-unmatched {staged_files}` — staged TS/TSX/JS/JSON only (fast).
  - `typos` — spell-check the whole working tree (config `_typos.toml`).
  - `taplo fmt --check` — check that staged `*.toml` are formatted (config `taplo.toml`).
- **pre-push** — `just check` (= typecheck + Biome + typos + coverage). Plus `rust-gate`: `just check-rust`, glob-filtered so it only runs when the push touches `*.rs` / `Cargo.*` (a JS-only push skips it). The full gate before code leaves the machine.
- **CI** (`.github/workflows/ci.yml`, `push: [main]` and all PRs) — four jobs. **check**: `jdx/mise-action` → `pnpm install --frozen-lockfile` → `just check` → `just build` (pnpm store cached). **e2e**: installs the Playwright browser (`playwright install --with-deps chromium`) and runs `just e2e`. **rust**: an Ubuntu + Windows matrix that installs Tauri's Linux system libs (WebKitGTK etc.) on Linux, caches cargo, and runs `just check-rust`. **mutation** (PR-only): diffs the PR against its base and runs `just mutation-diff` / `just mutation-rust-diff` on just the changed code. Each mirrors a local recipe, so green locally → green in CI.

**Don't bypass the hooks with `--no-verify`.** CI runs the same gate, so it fails there anyway.

### Mutation testing (the fourth gate)

Coverage proves a line *ran*; mutation testing proves a test would *fail* if that line were wrong. StrykerJS mutates the TS pure-logic layers (`src/domain` / `src/lib`, via `vitest.stryker.config.ts` + `stryker.config.json`), and cargo-mutants mutates the Rust core crate (`.cargo/mutants.toml`) — the same pure layers that carry the 90% coverage thresholds.

- **PR-diff scope.** The CI `mutation` job only mutates what the PR touched (Stryker via a node driver that lists changed `domain`/`lib` files for `--mutate`; cargo-mutants via `--in-diff`). It enforces the *new* change without demanding you first clear the whole existing backlog — the same "enforce on the diff" spirit as the coverage gate.
- **The two sides gate differently.** Stryker uses a percentage `break` threshold (`thresholds.break`); cargo-mutants has **no percentage** — a single surviving mutant exits non-zero. Mind the asymmetry when reading failures.
- **A whole-file caveat (TS).** Stryker has no line-level diff filter, so `--mutate <changed file>` re-mutates the *entire* file — a one-line edit to a big well-tested file can surface a pre-existing survivor. `incremental` (cached in CI) reuses unchanged mutants to soften this; cargo-mutants is line-scoped and doesn't have the issue.
- **Rollout.** The job is currently **report-only** (`continue-on-error: true`, and `break: null` in `stryker.config.json`). Measure a baseline with `just mutation` / `just mutation-rust`, set `break` a few points under the real score, then drop `continue-on-error` to enforce.

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

Phase 2 **added** a Tauri v2 shell and a Rust core without rewriting `src/ui` / `src/features` / `src/domain`. The shape it took (follow it when extending the backend):

1. **The Rust core** (`crates/photo-diary-core/`): `kamadak-exif` for EXIF (+ orientation correction), `image`'s `AvifEncoder` for full-res visually-lossless AVIF masters, `walkdir` for scanning, `rusqlite` (SQLite, `user_version` migrations) for metadata, `sha2` for folder dedup. Import is async with per-file error reporting; HEIC/HEIF/AVIF are skipped as unsupported (the `image` crate can't decode them). Imported photos are kept permanently as lightweight masters under the app's local data dir.
2. **Raw DTOs, not port shapes.** The Rust commands return raw records (`PhotoDto`, `MonthRecordDto`, `DayCountDto`, notes, folders, stats) with `#[serde(rename_all = "camelCase")]`. **The `DayEntry` grouping, calendar grid, heatmap and highlights are assembled in TS** by `src/domain/build/*` — not on the Rust side. Only `Photo` maps ~1:1 from a DTO. The port is the contract; the builders are shared with the mock so both backends agree.
3. **`TauriPhotoLibrary`** (`src/data/tauri/`): implements `PhotoLibrary` by `invoke`ing commands (`commands.ts` holds the typed wrappers + DTO types), mapping DTOs to `Photo` (thumbnails/masters via `convertFileSrc`), and running the `domain/build` functions.
4. **Runtime selection.** `providers.tsx` picks `TauriPhotoLibrary` or `MockPhotoLibrary` via `isTauri` — **the UI is unchanged**.
5. **The gates already cover it.** `mise.toml` pins Rust; the justfile has `app-*` / `check-rust`; the pre-push `rust-gate` and the CI `rust` matrix run `just check-rust`; `taplo` formats the Cargo TOML. Keep new Rust recipes/CI steps here (local == CI).

2b "day detail (virtual scrolling)" and 2c "multi-night events" remain partial: `DayDetailView` is a static mock kept unrouted, and `event` cards render only from mock fixtures (the Rust-fed `buildTimeline` doesn't emit `kind: 'event'` yet). When wiring them, follow the same style: extend the port, feed raw records through a `domain/build` function, and confine the UI to a feature slice.
