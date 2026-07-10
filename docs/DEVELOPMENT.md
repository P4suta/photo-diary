# Development guide

A shared handbook for anyone touching photo-diary. It collects the "invariants you must not break" and pointers to the canonical files where their rationale lives. When this text and the actual files disagree, **the actual files (mise.toml / justfile / lefthook.yml / .github/workflows/ci.yml) win** — file an issue to fix this page.

photo-diary is a local desktop photo diary app aiming to sit "halfway between a photo album and a journal." It automatically creates a "day" from the capture time (EXIF), lays out today's photos in chronological order, lets you write just a few lines of note about the day, and lets you look back through a calendar and a yearly heatmap.

## Reading order to start

1. **This guide** — the fixed rules and the things it deliberately won't do (non-goals).
2. **[ARCHITECTURE](ARCHITECTURE.md)** — dependency direction, the `PhotoLibrary` port seam, and how the feature slices are split.
3. The primary source in the code — `mise.toml` (tools), `justfile` (tasks), `lefthook.yml` (hooks), `.github/workflows/ci.yml` (CI). If any of these contradict the above, these win.

## Current phase and non-goals

photo-diary proceeds in 2 phases. **Don't mistake which phase you're in.**

- **Phase 1 (the current state of this repository = implemented).** The React / TypeScript / Vite / Tailwind frontend alone. All data is mocked (`src/data/mock/`). Every screen works in the browser (`http://localhost:5173`). There's no native shell yet.
- **Phase 2 (not started).** **Layer on** a Tauri v2 shell and a Rust core. Don't rewrite the UI — just swap out the mock implementation port and all (see "Layering Tauri on in Phase 2" below).

What it deliberately won't do (non-goals):

> AI · face recognition · a photo backup service · cloud sync of the originals.

photo-diary **keeps** the photos you take permanently in an internal library, but not the originals — they're AVIF, full-resolution, visually lossless lightweight masters. Search stays limited to date and place. Before adding a new feature, check that it doesn't fatten the "halfway between a photo album and a journal" concept. Endless feature accretion is a non-goal.

## Fixed architectural rules

Even if it compiles, breaking these is a regression. Dependencies point **inward only** (outer layers know inner ones; inner layers don't know outer ones).

- **Dependency direction.** `src/ui` / `src/features` → `src/app` (TanStack Query hooks) → `src/domain/ports.ts` (the `PhotoLibrary` interface) ← `src/data/mock` (`MockPhotoLibrary` implements it). The UI doesn't touch the concrete backend directly — it depends **only through the `PhotoLibrary` port** (dependency inversion). This is the seam that lets Phase 2 swap the mock painlessly.
- **Keep `src/domain/` pure.** `models.ts` (the `DayEntry` discriminated union, `Photo`, `TimeCluster`, etc.), `ports.ts`, `heatmap.ts`, `calendar.ts`, `tokens.ts` depend on neither React nor UI. The only `import`s allowed here are modules within the same `domain/`. The JSON the Rust core returns in Phase 2 is shaped to match these types too.
- **`PhotoLibrary` is the one seam.** Consolidate all backend interaction into the single interface in `src/domain/ports.ts`. Don't call `fetch` directly from a hook, or `new` up `MockPhotoLibrary` in a component. Obtaining the library goes only through `useLibrary()` (`src/app/library-context.tsx`).
- **Server state is TanStack Query, UI state is Zustand.** Confine data fetching, caching, and mutations to the hooks in `src/app/queries.ts` (`useTimeline` / `useCalendarMonth` / `useHeatmap` / `useHighlights` / `useStats` / `useFolders` / `usePlaceFacets` / `useSaveNote` / `useToggleStar`). Query keys are managed centrally by `qk` in the same file. Theme lives in `src/app/theme.ts`, and other UI state in `src/app/ui-store.ts` (both Zustand).
- **The single source of truth for design tokens is `src/index.css`.** `:root` / `.dark` / `[data-accent]` / heat variables live there. `tailwind.config.ts` just bridges those CSS variables into Tailwind — don't hardcode colors into components. The accent is `--moss` (moss / dusk / clay), with both light and dark supported. The typeface is Noto Sans JP.
- **`DayEntry` must always be rendered via an exhaustive switch.** `kind` is the discriminated union `'photos' | 'note_only' | 'empty' | 'digest'`. The card side branches exhaustively on `kind` (`strict` + `noFallthroughCasesInSwitch` in `tsconfig.app.json` catch omissions).

## Toolchain & shell promises

- **Tools are pinned in `mise.toml`.** node (lts), pnpm (10), biome (2.5.0), just (1), lefthook (2), `github:crate-ci/typos`, `cargo:committed`, `cargo:taplo-cli` are declared. Don't install anything ad hoc via rustup / winget / manual download — add it to `mise.toml` and run `mise install` (or `just setup`). Local and CI resolve the same versions from this same single file. `cargo.binstall = true` under `[settings]` makes cargo-backend tools fetch prebuilt binaries rather than compiling from source (fast on both local and CI).
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
| `just check` | `typecheck` + `lint` + `typos` | the full local gate (identical to CI) |
| `just build` | `pnpm build` (`tsc -b && vite build`) | production build |
| `just clean` | remove `dist` and `node_modules/.vite` | node_modules is kept |

The pnpm scripts (`package.json`) are `dev` / `build` / `preview` / `typecheck`. The justfile wraps these thinly. Day to day, use `just` rather than raw pnpm.

## Quality gates (hooks / CI)

The gates share one definition between local and CI (local == CI). The hooks are managed by lefthook and installed by the `lefthook install` in `just setup`.

- **commit-msg** — `committed --commit-file {1}`. Enforces Conventional Commits and tidies the history toward future release automation. `committed` skips `fixup!` / merge commits, so autosquash rebases pass as-is. Config is `committed.toml`.
- **pre-commit** (parallel) — 3 jobs:
  - `biome check --no-errors-on-unmatched {staged_files}` — staged TS/TSX/JS/JSON only (fast).
  - `typos` — spell-check the whole working tree (config `_typos.toml`).
  - `taplo fmt --check` — check that staged `*.toml` are formatted (config `taplo.toml`).
- **pre-push** — `just check` (= typecheck + Biome + typos). The full gate before code leaves the machine.
- **CI** (`.github/workflows/ci.yml`, `push: [main]` and all PRs) — install the pinned toolchain via `jdx/mise-action` → `pnpm install --frozen-lockfile` → `just check` → `just build`. It runs the exact same `just check` as pre-push, so if it's green locally it's green in CI.

**Don't bypass the hooks with `--no-verify`.** CI runs the same gate, so it fails there anyway.

## Editor

`.vscode/extensions.json` proposes recommended extensions (Extensions: Show Recommended Extensions):

- **biomejs.biome** — lint + format for TS/TSX/JSON (matches `just lint` / `just fmt`).
- **bradlc.vscode-tailwindcss** — Tailwind IntelliSense aligned with the token bridge in `tailwind.config.ts`.
- **tamasfe.even-better-toml** — TOML editing for `mise.toml` and others (matches taplo).
- **skellock.just** — syntax highlighting for the justfile (setup/dev/check/build recipes).

In any editor, the canonical formatters/linters are Biome (TS/TSX/JSON), taplo (TOML), and typos. When in doubt, don't format by hand — run `just fmt`. Confirm the toolchain matches the pins with `just doctor`.

## How to add a new feature (feature slice + through the port)

A feature encapsulates UI and hooks under `src/features/<name>/` (existing: `timeline`, `calendar`, `lightbox`, `library`, `highlights`, `import`, `onboarding`, `tokens`, `shell`). Add new features along this seam:

1. **Domain first.** Add the types you need to `src/domain/models.ts` (React-free). Put pure logic in functions under `src/domain/` (`heatmap.ts` / `calendar.ts` are the models to follow).
2. **Widen the port.** If you need data, add one read (`Promise<T>`) or mutation method to `PhotoLibrary` in `src/domain/ports.ts`.
3. **Implement the mock.** Implement the same method in `src/data/mock/MockPhotoLibrary.ts`, and put the fixed values it returns in `src/data/mock/fixtures.ts`. This keeps the screen working in Phase 1.
4. **One query hook.** Add a `qk` key and a `useXxx()` hook to `src/app/queries.ts` (fetch with `useQuery`, update with `useMutation` + `invalidateQueries` on the related keys). The hook just takes the port from `useLibrary()` and never touches the concrete class.
5. **UI in a feature slice.** Put the component under `src/features/<name>/` and have it call only the hook above. Shared look-and-feel parts go in `src/ui/` (`Button` / `Segmented` / `PhotoTile` / `icons`), small helpers in `src/lib/` (`cn.ts` / `format.ts`). Colors always go through the tokens in `src/index.css`.
6. **Wire the route.** For a screen, add a route to `src/app/router.tsx`.

**Don't:** call `fetch` directly from a component / `new` up `MockPhotoLibrary` in the UI / import React into `domain/` / hardcode colors without going through tokens.

## Where the mock data lives

- `src/data/mock/MockPhotoLibrary.ts` — the Phase 1 in-memory implementation of the `PhotoLibrary` port.
- `src/data/mock/fixtures.ts` — the fixed values (`timeline`, `julyRecords`, `highlights`, `stats`, `folders`, `placeFacets`). The calendar month grid is fixed to July 2026, and the heatmap and month cells are assembled by the builders in `domain/calendar.ts` / `domain/heatmap.ts`.

The port is `new MockPhotoLibrary()`'d exactly once in `src/app/providers.tsx` and handed to all UI from `LibraryProvider`. The swap point is this one place.

## Layering Tauri on in Phase 2 (outline, not started)

Phase 2 just **adds** a Tauri v2 shell and a Rust core; it doesn't rewrite `src/ui` / `src/features` / `src/domain`. An outline of the steps:

1. **Implement the Rust core.** `kamadak-exif` for EXIF reading, `ravif` / `image` for AVIF conversion, `walkdir` for folder scanning, SQLite for the metadata DB. Imported photos are kept permanently in the internal library as lightweight masters (AVIF, full-resolution, visually lossless).
2. **Shape the Tauri commands to `PhotoLibrary`.** Make the JSON the Rust side returns match the types in `src/domain/models.ts` (`DayEntry` / `Photo`, etc.) exactly. The port is the contract.
3. **Write `TauriPhotoLibrary`.** Add a new class under `src/data/` that implements `PhotoLibrary`, with each method just calling Tauri's `invoke` (the logic lives on the Rust core side).
4. **Swap in the provider.** Change `new MockPhotoLibrary()` in `src/app/providers.tsx` to `new TauriPhotoLibrary()` — **the UI is unchanged**.
5. **Extend the tools/gates.** `cargo:committed` / `cargo:taplo-cli` already exist, and `taplo` applies as-is to formatting the Phase 2 Tauri-side `Cargo.toml`. If you need Rust recipes or CI steps, add them to the justfile and `.github/workflows/ci.yml` (keeping local == CI).

2b "day detail (virtual scrolling)" and 2c "multi-night events" are also handled in Phase 2. Both proceed in the same style: add a read method to the port and confine the UI to a feature slice.
