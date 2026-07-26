# photo-diary

**A local desktop photo diary that sits halfway between a photo album and a journal.**

Your photos become your diary — no manual dating, no album wrangling. It groups your photos into "days" by capture time, lays them out chronologically, and lets you write a few lines about the day. You look back through a calendar and a yearly heatmap.

> Status: v0.1 for Windows. The React UI, Rust core and Tauri v2 shell are wired end to end and covered by browser, Rust and native Windows acceptance tests.

## Features

- Groups photos into days from EXIF capture time
- Chronological timeline of a day's photos
- A few lines of note per day
- Calendar + yearly heatmap to look back
- Search by date and place
- Light / dark themes, Noto Sans JP, `--moss` accent (moss / dusk / clay)

## Not in scope

- **No AI or face recognition** — no subject tagging, no scene classification.
- **Not a backup service** — no cloud sync or sharing.

Imported photos are kept in an internal library under the app's local data dir (AVIF masters in `library/`, display thumbnails in `thumbnails/`, metadata in `photo-diary.db`). The stored master is a full-resolution, visually-lossless AVIF re-encode — **not a backup of the original**. EXIF/ICC is not carried into the AVIF; the metadata that matters (capture time, GPS, dimensions) lives in the SQLite DB.

## Quick start

The toolchain is pinned with [mise](https://mise.jdx.dev/) and tasks run through [just](https://just.systems/). The package manager is pnpm.

```
just setup   # pinned toolchain + git hooks + JS deps
just dev     # Vite dev server → http://localhost:5173
```

Run `just` with no arguments to list all recipes. Common ones: `just typecheck`, `just lint`, `just test`, `just check` (including REUSE 3.3), and `just build`. For the desktop app: `just app-dev` / `just app-build`; Windows native acceptance is `just native-e2e`.

## Architecture

Dependencies point inward. The UI talks to the `PhotoLibrary` port through TanStack Query, so both backends — a mock and the Rust core — implement the same port and the UI never changes. `providers.tsx` picks between them at runtime (mock in the browser, `TauriPhotoLibrary` inside the desktop window).

```
src/features/  ──▶  src/app/  ──▶  src/domain/
(timeline,          (queries,         (models, ports,
 calendar,           theme, router)    builders, tokens — React-free)
 lightbox, …)            │
                         ▼
         src/data/mock/  ⇄  src/data/tauri/   ── PhotoLibrary implementations
```

- **`src/domain/`** — pure models and logic, React-free (`models.ts`, `ports.ts`, `build/*`, `tokens.ts`, …).
- **`src/data/`** — `MockPhotoLibrary` (browser dev) and `TauriPhotoLibrary` (real backend + typed `invoke` wrappers).
- **`src/app/`** — providers, router, TanStack Query hooks, Zustand stores, i18n.
- **`src/ui/`** — feature-agnostic components; **`src/features/`** — timeline, calendar, lightbox, library, highlights, import, onboarding, tokens, shell.
- **`src/index.css`** — the single source of truth for design tokens.
- **`crates/photo-diary-core/`** — the Rust core (scan, EXIF, orientation, AVIF, thumbnails, SQLite, read queries). **`src-tauri/`** — the Tauri v2 shell exposing it over IPC.

More detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

## Stack

- **Frontend** — Vite + React 19 + TypeScript (strict) + Tailwind CSS 4 (CSS-first, official Vite plugin) + TanStack Query + Zustand + react-router + i18next (en/ja).
- **Desktop** — Tauri v2 shell + a Rust core: walkdir scan, kamadak-exif, `image`/AVIF transcode, rusqlite, sha2 for dedup.

## Status

- **Frontend** — implemented. In browser dev, data comes from a mock (`MockPhotoLibrary` + `fixtures.ts`).
- **Rust core** — SQLite v2, bounded timeline reads, stable day cursors, offline place resolution, caption/★/event persistence, export, cache recovery, recursive import and watched-folder jobs.
- **Tauri shell** — real IPC for every library action plus startup scan, recursive watched-folder monitoring with 2-second debounce and 60-second reconnect, pause/resume and library-change events.
- **Diary UI** — date/place search, virtualized day detail, time/place clusters, captions, multi-select ★, event metadata, calendar navigation, drag/drop onboarding, Settings operations and en/ja accessibility.
- **Verification** — Vitest/Playwright, Rust test + Clippy, REUSE 3.3, and feature-isolated WebdriverIO native E2E against real SQLite/IPC on Windows.

Supported input is JPEG/PNG/WebP/TIFF/BMP/GIF. HEIC/HEIF/AVIF inputs are detected and skipped with counts; corrupt files are reported without aborting the rest of an import. Stored AVIF masters are internal diary copies, not backups of the original files.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Commits follow Conventional Commits; `just check` runs the same gate as CI.

## License

Dual-licensed under either of

- MIT license ([`LICENSE-MIT`](LICENSE-MIT))
- Apache License, Version 2.0 ([`LICENSE-APACHE`](LICENSE-APACHE))

at your option. Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in this work shall be dual-licensed as above, without any additional terms or conditions.

Copyright and license metadata is machine-checked against the REUSE Specification; see [`REUSE.toml`](REUSE.toml), [`LICENSES/`](LICENSES), and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

The Windows binary includes `zenavif` for internal thumbnail recovery. That component is used under AGPL-3.0-only unless the distributor holds Imazen's commercial license; see the third-party notices before redistributing binaries.
