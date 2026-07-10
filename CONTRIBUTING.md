# Contributing to photo-diary

Welcome to photo-diary — a desktop photo diary app that runs locally, aiming to sit "halfway between a photo album and a journal." This document collects the day-to-day development loop and the gates you must pass before committing and before pushing. Please read it before you start.

The current repository is Phase 1 (a React/TypeScript/Vite/Tailwind frontend with mocked data). Phase 2 (the Tauri v2 shell + Rust core) has not started yet, so don't pre-emptively add tooling or procedures around it.

## Setup

The toolchain is pinned with [mise](https://mise.jdx.dev/) (`mise.toml`), and tasks run through [just](https://github.com/casey/just) (`justfile`). Local and CI resolve the same versions from the same `mise.toml`.

```
just setup       # Install the pinned toolchain + git hooks (lefthook) + pnpm deps in one go
just doctor      # Verify the resolved toolchain matches the pins in mise.toml
just dev         # Vite dev server → http://localhost:5173
```

`just setup` runs `mise install` → `lefthook install` → `pnpm install` in order under the hood. Don't install the toolchain ad hoc on the spot. Declare what you need in `mise.toml` and install it with `mise install` (or `just setup`). The `cargo:` tools (committed / taplo-cli) fetch prebuilt binaries rather than compiling from source, thanks to the `cargo.binstall = true` setting.

The package manager is pnpm (`packageManager: pnpm@10.34.4`). npm is not used. If you haven't activated mise in your shell, prefix each command with `mise exec --`.

## Development loop

```
just dev         # Vite dev server (http://localhost:5173)
just typecheck   # Type check only (tsc -b --noEmit). The fastest inner loop
just lint        # Biome lint + format check (same binary and version as pre-commit / CI)
just fmt         # Auto-format: Biome(TS/TSX/JSON) → taplo(TOML)
just typos       # Spell-check the sources (same as pre-commit)
```

When you want to iterate quickly on types alone, use `just typecheck`. When you want to format before stepping away, use `just fmt` (Biome handles TS/TSX/JSON, taplo handles TOML).

### The architectural seam

Keep dependencies pointing inward only. The UI depends on the `PhotoLibrary` port in `src/domain/ports.ts` only through `src/app/queries.ts` (TanStack Query) — dependency inversion. Don't break the premise that in Phase 2 you only swap `MockPhotoLibrary` in `src/data/mock/` for `TauriPhotoLibrary`, and the UI passes unchanged. The single source of truth for design tokens is `src/index.css` (`:root` / `.dark` / `[data-accent]` / heat variables), which Tailwind references. Don't hardcode colors or accents (--moss / dusk / clay) as literal values; go through these tokens.

## Commit & PR conventions

We use [Conventional Commits](https://www.conventionalcommits.org/). Subjects start lowercase (e.g. `feat(timeline): add digest card`). This isn't decoration — it keeps the history tidy for future release automation.

This convention is **enforced** locally. The lefthook `commit-msg` hook inspects each message through `committed` (`committed.toml` is the source of the config). The allowed types are the following; any type not listed here is rejected:

```
feat  fix  perf  docs  refactor  test  chore  ci  build  deps  style  revert
```

`committed` skips `fixup!` / merge commits, so a rebase with autosquash passes as-is. There's no subject length limit (PR titles tend to get long). What's enforced is the *format*.

## Before you push

- `just check` (= `typecheck` + `lint` (Biome) + `typos`) must be green. This is exactly the gate the pre-push hook runs, sharing the same definition as CI.
- Before larger changes it's safe to also confirm `just build` (`tsc -b` + `vite build`) passes (same as CI's last step).
- If you touched tokens in `src/index.css`, visually check both light/dark and accent switching for breakage.

### Don't bypass the hooks

The git hooks (lefthook) are installed by the `lefthook install` in `just setup`. Don't bypass them with `--no-verify`. CI (`.github/workflows/ci.yml`) runs the same gate, so anything that slips past locally will just fail there. Fixing it on your machine is faster and safer.

The role of each hook:

- **commit-msg** — `committed` checks Conventional Commits.
- **pre-commit** — `biome check` on staged TS/TSX/JSON, `typos` on the whole working tree, `taplo fmt --check` on `*.toml` (are they formatted).
- **pre-push** — `just check` (typecheck + Biome + typos). This one can't be skipped as a whole.

## Code formatting with Biome

All linting and formatting of TS/TSX/JSON is handled by Biome (`biome.json`, pinned to 2.5.0 in `mise.toml`). Local, the pre-commit hook, and CI all use the same binary and version, so there's no formatting drift. The key conventions are in `biome.json`:

- 2-space indentation, line width 100.
- JS/TS uses single quotes, semicolons only when needed (`asNeeded`), and trailing commas always (`all`).
- CSS is out of Biome's scope (`!**/*.css`). Tokens are written by hand.

Leave formatting to `just fmt` rather than doing it by hand. Any unformatted spot makes `just lint` (and therefore pre-commit and CI) fail. If you place editor config under `.vscode/`, JSON files should be valid JSONC formatted at 2 spaces (comments allowed).

## Local == CI

Reproducibility is the top priority. CI (`ci.yml`) installs the same toolchain as `mise.toml` via `jdx/mise-action`, then runs `pnpm install --frozen-lockfile` → `just check` → `just build`. If `just check` and `just build` are green on your machine, CI should produce the same result. `--frozen-lockfile` fails loudly rather than silently re-resolving when `pnpm-lock.yaml` is stale, so don't forget to commit the lockfile after adding a dependency.

## Scope

photo-diary is a **local photo diary**. Automatically create a "day" from the capture time (EXIF), lay out today's photos chronologically, write a few lines of note about the day, and look back through a calendar and a yearly heatmap — that's the scope. It does no AI or face recognition. It's also not a photo backup service (imported photos are kept permanently in the internal library as AVIF, full-resolution, visually lossless lightweight masters). Before proposing a new capability, check that it doesn't violate these non-goals.
