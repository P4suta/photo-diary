# photo-diary

**A local desktop photo diary that sits halfway between a photo album and a journal.**

> Status: In development. Phase 1 (the React frontend) is implemented and verified. For Phase 2, the Rust core (`crates/photo-diary-core`) is implemented and tested, and the Tauri v2 shell (`src-tauri`) builds. What remains is fully wiring the frontend to the backend.

## What is this

photo-diary is an app where the photos you take become your diary. There's no manual dating and no album wrangling.

- Automatically creates a "day" from the capture time (EXIF)
- Lays out today's photos in chronological order
- Lets you write just a few lines of note about the day
- Look back through a calendar and a yearly heatmap
- Search is limited to date and place

The look is a memos-style, Twitter-like feed plus a calendar. The typeface is Noto Sans JP, the accent is `--moss` (moss / dusk / clay), and both light and dark modes are supported.

## What it deliberately won't do

- **No AI or face recognition.** No automatic subject tagging, no scene classification.
- **Not a photo backup service.** Cloud sync and sharing are out of scope.

That said, imported photos are kept permanently in an internal library. What's stored is not the original itself, but an AVIF, full-resolution, visually lossless lightweight master.

## Quick start

The toolchain is pinned with [mise](https://mise.jdx.dev/) (`mise.toml`), and tasks run through [just](https://just.systems/) (`justfile`). Local and CI resolve the same versions from the same single file.

```
just setup   # Set up the pinned toolchain + git hooks (lefthook) + JS deps (pnpm) in one go
just dev     # Vite dev server → http://localhost:5173
```

For a sanity check right after setup, use `just doctor` (shows the resolved toolchain and mise diagnostics). The package manager is pnpm (`packageManager: pnpm@10.34.4`). npm is not used.

## Architecture

Dependencies always point inward. The UI depends on the `PhotoLibrary` port only through TanStack Query (dependency inversion). Thanks to this seam, Phase 2 only needs to swap the mock implementation for the Tauri one, and the UI stays unchanged.

```
src/features/  ──▶  src/app/  ──▶  src/domain/
(timeline,          (queries=          (models, ports,
  calendar,           TanStack Query,     heatmap, calendar,
  lightbox, …)        theme, router)      tokens — React-free)
                          │
                          ▼
                     src/data/mock/  ── PhotoLibrary port implementation
                     (swapped for the Tauri implementation in Phase 2)
```

- **`src/domain/`** — Pure models and logic (React-free). `models.ts` (the `DayEntry` discriminated union, `Photo`, and more), `ports.ts` (the `PhotoLibrary` interface), `heatmap.ts`, `calendar.ts`, `tokens.ts`.
- **`src/data/mock/`** — `MockPhotoLibrary` (the `ports` implementation) and `fixtures.ts`. In Phase 2 it's just swapped for `TauriPhotoLibrary`.
- **`src/app/`** — `providers.tsx`, `router.tsx`, `queries.ts` (TanStack Query hooks), `theme.ts` (Zustand), `ui-store.ts`, `library-context.tsx`.
- **`src/ui/`** — `Button`, `Segmented`, `PhotoTile`, `icons` (SVGs ported from the design).
- **`src/features/`** — `timeline`, `calendar`, `lightbox`, `library` (settings), `highlights`, `import`, `onboarding`, `tokens`, `shell`. Each feature encapsulates its UI and hooks.
- **`src/lib/`** — `cn.ts`, `format.ts`.
- **`src/index.css`** — The single source of truth for design tokens (`:root` / `.dark` / `[data-accent]` / heat variables). Tailwind references this.

## Tasks

Everything is a `justfile` recipe (running `just` with no arguments prints the list).

| Recipe | What it does |
| --- | --- |
| `just setup` | Set up the pinned toolchain + git hooks + JS deps in one go (first time only) |
| `just doctor` | Show the resolved toolchain and mise diagnostics |
| `just dev` | Vite dev server (http://localhost:5173) |
| `just typecheck` | Type check (`tsc -b --noEmit`, fast inner loop) |
| `just lint` | Biome lint + format check (`biome check .`) |
| `just fmt` | Auto-fix + format (Biome → taplo) |
| `just typos` | Spell-check the sources (typos) |
| `just check` | The full local gate = `typecheck` + `lint` + `typos` (same as CI) |
| `just build` | Production build (`tsc -b` + `vite build`) |
| `just clean` | Remove build output and the Vite cache (`node_modules` is kept) |

Corresponding pnpm scripts: `dev`, `build`, `preview`, `typecheck`.

## Gates (local == CI)

All gates are defined in one place and shared between local and CI.

- **git hooks (lefthook, installed by `just setup`)**
  - `commit-msg`: Conventional Commits check via committed.
  - `pre-commit`: Biome + typos + `taplo fmt --check` on staged files.
  - `pre-push`: `just check` (the full gate).
- **CI (`.github/workflows/ci.yml`)**: `jdx/mise-action` → `pnpm install --frozen-lockfile` → `just check` → `just build`. It runs the exact same gate as pre-push.

Don't bypass the hooks with `--no-verify`. CI runs the same gate, so it will fail there anyway.

## Stack

Vite 6 + React 19 + TypeScript (strict) + Tailwind v3 + shadcn-compatible tokens + TanStack Query + Zustand + react-router v7.

## Phases

- **Phase 1 — done**: A React / TypeScript / Vite / Tailwind frontend. Data is mocked (`MockPhotoLibrary` + `fixtures.ts`).
- **Phase 2 — implemented (only GUI on-device verification remains)**:
  - **Rust core (`crates/photo-diary-core`) — tested**: scanning (walkdir) / EXIF (kamadak-exif) / thumbnails / AVIF conversion (ravif) / SQLite (rusqlite) / the import pipeline plus a read query layer. 28 tests plus clippy. `just app-test`.
  - **Tauri v2 shell (`src-tauri`) — builds**: `import_folder` and 12 commands in total call `photo_diary_core`. Launch with `just app-dev`, generate an installer with `just app-build`.
  - **Real-data wiring — done**: `TauriPhotoLibrary` (`src/data/tauri/`) makes real invokes → pure functions in `src/domain/build/` (vitest-covered) produce the port types. Thumbnails use `convertFileSrc`; import goes folder dialog → query refetch. The UI is unchanged.
  - **Screens — done**: 2b day detail (`/day`), 2c multi-night events (event cards in the timeline).
  - **Remaining**: only GUI operation verification on-device (Windows WebView2).

## Dev container

`.devcontainer/` lets you drop straight into VS Code / GitHub Codespaces. `postCreateCommand` runs `mise install` (resolving node/pnpm/rust/biome/… from `mise.toml`) plus `pnpm install` plus `lefthook install`. Tauri v2's Linux build dependencies (WebKitGTK, etc.) are bundled in as well.

## Where the design comes from

The primary source for the design is the Claude Design handoff (`_handoff/`, gitignored, reference-only). The internal memo `CLAUDE.md` is also gitignored.
