# photo-diary

**A local desktop photo diary that sits halfway between a photo album and a journal.**

> Status: In development. Phase 1 (the React frontend) is implemented and verified. Phase 2 is implemented too: the Rust core (`crates/photo-diary-core`) does the real import/read work and is tested, the Tauri v2 shell (`src-tauri`) exposes it over IPC, and `TauriPhotoLibrary` wires the frontend to it. The app picks the backend at runtime — the mock in a browser, the real Rust core inside the Tauri window. What remains is on-device GUI verification (Windows/WebView2) and the later screens (day detail 2b, multi-night events 2c) noted under [Phases](#phases).

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

That said, imported photos are kept permanently in an internal library under the app's local data dir (`library/` for the AVIF masters, `thumbnails/` for display thumbnails, `photo-diary.db` for metadata, all referenced by DB-relative paths). What's stored is not the original itself, but an AVIF, full-resolution, visually lossless lightweight master. **This is not a backup** — the master is a re-encode, and EXIF/ICC metadata is not carried into the AVIF; the metadata that matters (capture time, GPS, dimensions) lives in the SQLite DB instead.

### Known limitations

- **HEIC / HEIF / AVIF source files are skipped.** The `image` crate can't decode them, and the toolchain is reproducibility-first (no `libheif` system dependency). Such files are recognized, counted as `skippedUnsupported`, and reported back — they don't abort the import.
- Import continues past individual bad files (corrupt / unreadable), reporting each failure per-file.
- Search is an honest disabled placeholder (date/place filtering is a later phase); several Settings controls (add/rescan/remove folder, cache regenerate/clear, open location) are disabled until wired; day detail (2b) is unrouted. These surfaces are deliberately inert rather than faking behavior.

## Quick start

The toolchain is pinned with [mise](https://mise.jdx.dev/) (`mise.toml`), and tasks run through [just](https://just.systems/) (`justfile`). Local and CI resolve the same versions from the same single file.

```
just setup   # Set up the pinned toolchain + git hooks (lefthook) + JS deps (pnpm) in one go
just dev     # Vite dev server → http://localhost:5173
```

For a sanity check right after setup, use `just doctor` (shows the resolved toolchain and mise diagnostics). The package manager is pnpm (`packageManager: pnpm@10.34.4`). npm is not used.

## Architecture

Dependencies always point inward. The UI depends on the `PhotoLibrary` port only through TanStack Query (dependency inversion). Thanks to this seam, both backends — the Phase 1 mock and the Phase 2 Rust core — implement the same port, and the UI never changes. `providers.tsx` picks between them at runtime via `isTauri` (mock in the browser, `TauriPhotoLibrary` inside the desktop window).

```
src/features/  ──▶  src/app/  ──▶  src/domain/
(timeline,          (queries=          (models, ports,
  calendar,           TanStack Query,     heatmap/calendar types,
  lightbox, …)        theme, router)      build/*, tokens — React-free)
                          │
                          ▼
          src/data/mock/  ⇄  src/data/tauri/   ── PhotoLibrary implementations
        (MockPhotoLibrary)   (TauriPhotoLibrary)   (chosen at runtime by isTauri)
```

- **`src/domain/`** — Pure models and logic (React-free). `models.ts` (the `DayEntry` discriminated union, `Photo`, `ImportResult`, and more), `ports.ts` (the `PhotoLibrary` interface), `calendar.ts` / `heatmap.ts` (grid/heatmap types), `build/*` (the pure builders that assemble port types from raw records), `heat-level.ts`, `star.ts`, `tokens.ts`.
- **`src/data/mock/`** — `MockPhotoLibrary` (the `ports` implementation) and `fixtures.ts`, used in browser dev.
- **`src/data/tauri/`** — `TauriPhotoLibrary` (the real backend) and `commands.ts` (typed `invoke` wrappers + DTO types matching the Rust core).
- **`src/app/`** — `providers.tsx`, `env.ts` (`isTauri`), `router.tsx`, `queries.ts` (TanStack Query hooks), `theme.ts` (Zustand), `ui-store.ts`, `library-context.tsx`, `i18n.ts`.
- **`src/ui/`** — `Button`, `Segmented`, `PhotoTile`, `ErrorPanel`, `icons` (SVGs ported from the design).
- **`src/features/`** — `timeline`, `calendar`, `lightbox`, `library` (settings), `highlights`, `import`, `onboarding`, `tokens`, `shell`. Each feature encapsulates its UI and hooks.
- **`src/lib/`** — `cn.ts`, `format.ts`, `datetime.ts` (locale-aware `Intl` formatting).
- **`src/locales/`** — `en.json` / `ja.json` (i18next; strings never cross the port).
- **`src/index.css`** — The single source of truth for design tokens (`:root` / `.dark` / `[data-accent]` / heat variables). Tailwind references this.
- **`crates/photo-diary-core/`** — The Rust core: scanning, EXIF, orientation, AVIF transcode, thumbnails, SQLite, and the read-query layer. **`src-tauri/`** — the Tauri v2 shell exposing it as IPC commands.

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
| `just test` / `just test-watch` | Vitest (node + jsdom): unit / component / contract / a11y |
| `just coverage` | The same tests with V8 coverage (thresholds enforced on `domain`/`lib`) |
| `just check` | The full local gate = `typecheck` + `lint` + `typos` + `coverage` (same as CI) |
| `just e2e` | End-to-end (Playwright + real browser); first run needs `pnpm exec playwright install chromium` |
| `just verify` | Full local acceptance: `check` + `build` + `e2e` |
| `just build` | Production build (`tsc -b` + `vite build`) |
| `just clean` | Remove build output and the Vite cache (`node_modules` is kept) |
| `just app-dev` / `just app-build` | Run / package the Tauri desktop app (Phase 2) |
| `just app-test` / `just app-lint` | `cargo test --workspace` / clippy + `cargo fmt --check` |
| `just check-rust` | The full Rust-side gate (`app-test` + `app-lint`) |
| `just mutation` / `just mutation-rust` | Mutation baseline (StrykerJS on TS `domain`/`lib`, cargo-mutants on the Rust core); heavy, manual |
| `just mutation-diff` / `just mutation-rust-diff` | The same, scoped to changes vs a base ref — the PR-diff mutation gate |

Corresponding pnpm scripts: `dev`, `build`, `preview`, `typecheck`, `test`, `coverage`, `e2e`, `tauri`.

## Gates (local == CI)

All gates are defined in one place and shared between local and CI.

- **git hooks (lefthook, installed by `just setup`)**
  - `commit-msg`: Conventional Commits check via committed.
  - `pre-commit`: Biome + typos + `taplo fmt --check` on staged files.
  - `pre-push`: `just check` (the full gate), plus `just check-rust` when the push touches Rust files (`*.rs` / `Cargo.*`).
- **CI (`.github/workflows/ci.yml`)**: four jobs. `check` — `jdx/mise-action` → `pnpm install --frozen-lockfile` → `just check` → `just build` (the exact same gate as pre-push, with pnpm-store caching). `e2e` — installs the Playwright browser and runs `just e2e`. `rust` — a Linux + Windows matrix that installs Tauri's Linux system deps, caches cargo, and runs `just check-rust`. `mutation` (PR-only) — mutation-tests just the code the PR changed: StrykerJS on TS `domain`/`lib` (enforced, `break: 70` vs an 87% baseline) and cargo-mutants on the Rust core (report-only for now; runs single-threaded to keep the migration tests hermetic).

Don't bypass the hooks with `--no-verify`. CI runs the same gate, so it will fail there anyway.

## Stack

- **Frontend**: Vite 6 + React 19 + TypeScript (strict) + Tailwind v3 + shadcn-compatible tokens + TanStack Query + Zustand + react-router v7 + i18next (en/ja).
- **Desktop (Phase 2)**: Tauri v2 shell + a Rust core (`crates/photo-diary-core`) — walkdir scan, kamadak-exif, `image`/AVIF transcode, rusqlite (SQLite), sha2 for dedup.

## Phases

- **Phase 1 — done**: A React / TypeScript / Vite / Tailwind frontend. In browser dev the data is mocked (`MockPhotoLibrary` + `fixtures.ts`).
- **Phase 2 — implemented (on-device GUI verification remains)**:
  - **Rust core (`crates/photo-diary-core`) — tested**: scanning (walkdir), EXIF (kamadak-exif), EXIF-orientation correction, thumbnails, full-resolution visually-lossless AVIF masters (`image`'s AvifEncoder), SQLite (rusqlite) with `user_version` migrations, SHA-256 folder dedup, an async import pipeline with per-file error reporting, and a read-query layer. Covered by `cargo test --workspace`.
  - **Tauri v2 shell (`src-tauri`)**: exposes the core as IPC commands (`import_folder`, `list_photos`, `year_counts`, `save_note`, …). Import runs off the UI thread and streams per-file progress over a channel. Launch with `just app-dev`, package with `just app-build`.
  - **Real-data wiring — done**: `TauriPhotoLibrary` (`src/data/tauri/`) makes real invokes returning raw DTOs; the pure builders in `src/domain/build/` (vitest-covered) assemble the port types (grouping/heatmap/calendar/highlights live in TS, not Rust). Thumbnails and full-res masters resolve via `convertFileSrc`. `providers.tsx` selects this backend automatically inside the Tauri window.
  - **Later screens (partial)**: 2b day detail exists only as a static `DayDetailView` mock and stays unrouted until wired from real data; 2c multi-night events have domain types and an `EventCard`, but no backend event grouping yet (the Rust-fed timeline never emits `kind: 'event'`).
  - **Remaining**: on-device GUI verification (Windows/WebView2).

## Dev container

`.devcontainer/` lets you drop straight into VS Code / GitHub Codespaces. `postCreateCommand` runs `mise install` (resolving node/pnpm/rust/biome/… from `mise.toml`) plus `pnpm install` plus `lefthook install`. Tauri v2's Linux build dependencies (WebKitGTK, etc.) are bundled in as well.

## Where the design comes from

The primary source for the design is the Claude Design handoff (`_handoff/`, gitignored, reference-only). The internal memo `CLAUDE.md` is also gitignored.

## License

Dual-licensed under either of

- MIT license ([`LICENSE-MIT`](LICENSE-MIT))
- Apache License, Version 2.0 ([`LICENSE-APACHE`](LICENSE-APACHE))

at your option. Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in this work, as defined in the Apache-2.0 license, shall be dual-licensed as above, without any additional terms or conditions.
