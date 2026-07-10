# photo-diary task runner. Requires: mise — see mise.toml.
#
# `just` (no args) prints this menu, grouped by area. New here? Run `just setup`,
# then `just check`. Tools resolve through mise (activate mise in your shell, or
# prefix with `mise exec --`).

# just defaults to `sh`, which isn't guaranteed on Windows. powershell.exe always
# exists and runs the mise-shimmed tools (pnpm/biome/…) fine.
set windows-shell := ["powershell.exe", "-NoProfile", "-Command"]

default:
    @just --list --unsorted

# ── Setup ────────────────────────────────────────────────────────────────────

# One-time setup: install the pinned toolchain, git hooks, and JS deps.
[group('setup')]
setup:
    mise install
    lefthook install
    pnpm install

# Check the toolchain matches mise.toml (run right after `just setup`).
[group('setup')]
[doc('Show the resolved toolchain and mise diagnostics')]
doctor:
    mise doctor
    mise ls --current

# ── Daily loop ───────────────────────────────────────────────────────────────

# Vite dev server — http://localhost:5173
[group('daily')]
dev:
    pnpm dev

# Type-check without emitting — the fast inner loop.
[group('daily')]
typecheck:
    pnpm typecheck

# Lint + format check (Biome). Same binary + version the pre-commit hook and CI run.
[group('daily')]
lint:
    biome check .

# Auto-fix + format: Biome (TS/TSX/JSON) then taplo (TOML).
[group('daily')]
fmt:
    biome check --write .
    taplo fmt

# Source spell-check (same binary the pre-commit hook runs).
[group('daily')]
typos:
    typos

# Vitest in watch mode — the fast inner loop for tests.
[group('daily')]
test-watch:
    pnpm test:watch

# ── Gates ────────────────────────────────────────────────────────────────────

# Unit / component / contract / interaction / a11y tests (vitest: node + jsdom).
[group('gates')]
test:
    pnpm test

# Same tests with V8 coverage (thresholds enforced on domain/lib).
[group('gates')]
coverage:
    pnpm coverage

# End-to-end (Playwright, Vite dev + real browser). Heavy: `verify` / CI job / manual;
# NOT part of `check` (keeps pre-push fast). First run locally needs the browser:
# `pnpm exec playwright install chromium`. On Windows a vite dev server can linger on
# 5173 after the run (reused next time, so faster). If it wedges, kill the process on
# 5173 and re-run.
[group('gates')]
e2e:
    pnpm e2e

# Full local acceptance (the wall while you're not pushing). Reproduces every CI
# frontend job locally: typecheck + Biome + typos + coverage (thresholds) + production
# build + E2E. Green here means you can fully trust it without pushing. The Rust core is
# separate via `just check-rust`. If the browser isn't installed, once:
# `pnpm exec playwright install chromium`.
[group('gates')]
[doc('Full local acceptance: check + coverage + build + E2E (trust without CI)')]
verify: typecheck lint typos coverage build e2e

# The full local gate, in one shot: typecheck + Biome + typos + tests. Mirrors CI.
[group('gates')]
[doc('Full local gate: typecheck + Biome + typos + tests (mirrors CI)')]
check: typecheck lint typos test

# Production build (tsc -b + vite build).
[group('gates')]
build:
    pnpm build

# ── Housekeeping ─────────────────────────────────────────────────────────────

# Remove build output and the Vite cache (keeps node_modules).
[group('housekeeping')]
clean:
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue dist, node_modules/.vite

# ── Desktop (Tauri v2 — phase 2) ──────────────────────────────────────────────

# Run the Tauri desktop app in dev mode (Vite dev + native window).
[group('desktop')]
app-dev:
    pnpm tauri dev

# Build the Tauri app (produces installers).
[group('desktop')]
app-build:
    pnpm tauri build

# Test the Rust core (photo-diary-core).
[group('desktop')]
app-test:
    cargo test -p photo-diary-core

# Lint the Rust code (clippy -D warnings) + format check.
[group('desktop')]
app-lint:
    cargo clippy --workspace --all-targets -- -D warnings
    cargo fmt --all -- --check

# Full Rust-side gate (same as CI).
[group('desktop')]
check-rust: app-test app-lint
