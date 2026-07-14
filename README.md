# photo-diary

**A local desktop photo diary that sits halfway between a photo album and a journal.**

Your photos become your diary — no manual dating, no album wrangling. It groups your photos into "days" by capture time, lays them out chronologically, and lets you write a few lines about the day. You look back through a calendar and a yearly heatmap.

> Status: in development. The React frontend and the Rust core (import/read) are implemented and tested; the Tauri v2 shell wires them together. On-device GUI verification and a couple of later screens remain — see [Status](#status).

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

Run `just` with no arguments to list all recipes. Common ones: `just typecheck`, `just lint`, `just test`, `just check` (the full local gate), `just build`. For the desktop app: `just app-dev` / `just app-build`.

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

- **Frontend** — Vite + React 19 + TypeScript (strict) + Tailwind + TanStack Query + Zustand + react-router + i18next (en/ja).
- **Desktop** — Tauri v2 shell + a Rust core: walkdir scan, kamadak-exif, `image`/AVIF transcode, rusqlite, sha2 for dedup.

## Status

- **Frontend** — implemented. In browser dev, data comes from a mock (`MockPhotoLibrary` + `fixtures.ts`).
- **Rust core** — implemented and tested: scanning, EXIF + orientation, thumbnails, full-res AVIF masters, SQLite with migrations, SHA-256 dedup, async import with per-file error reporting, and a read-query layer.
- **Tauri shell** — exposes the core as IPC commands; import runs off the UI thread and streams per-file progress.
- **Later screens** — day detail (2b) is an unrouted mock; multi-night events (2c) have types and a card but no backend grouping yet.
- **Remaining** — on-device GUI verification (Windows/WebView2).

Known limitations: HEIC/HEIF/AVIF source files can't be decoded and are skipped (counted and reported, not fatal); import continues past corrupt files; search and several Settings controls are disabled placeholders until wired.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Commits follow Conventional Commits; `just check` runs the same gate as CI.

## License

Dual-licensed under either of

- MIT license ([`LICENSE-MIT`](LICENSE-MIT))
- Apache License, Version 2.0 ([`LICENSE-APACHE`](LICENSE-APACHE))

at your option. Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in this work shall be dual-licensed as above, without any additional terms or conditions.
