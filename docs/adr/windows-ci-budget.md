---
date: 2026-10-20
status: proposed
---

# Windows product verification on PR source updates

## Status

Proposed.

## Context

The product targets Windows.
CI also built a Linux desktop environment and ran both TypeScript and Rust mutation campaigns for every PR.
Main pushes repeated the same product jobs after merge.
Those campaigns add work to routine dependency and documentation updates without a specific unresolved test gap.

## Decision

Run four product jobs on opened, synchronized, and reopened PRs.
Keep frontend type checks, lint, license checks, coverage thresholds, and the production build.
Audit frontend runtime dependencies in the same check job.
Keep browser acceptance, Windows Rust workspace tests and Clippy, and Windows native acceptance.
Install only each job's required pinned tools.
Keep the existing required-check predicate for all retained jobs.

Remove automatic mutation campaigns and the unused Linux desktop build.
Keep local mutation commands for deliberate diagnosis of a bounded test gap.
Do not replace the removed work with scheduled, main, or manual Actions campaigns.
Keep release workflows and repository protections unchanged.

Migrate pnpm's package settings into its workspace file when updating to version 12.
Preserve the existing native-utils override and allow only esbuild's install script.
Use a scoped qs security override within major version 6 for typed-rest-client.
Update the compatible frontend test tools together and regenerate the lockfile with the pinned package manager.

## Verification boundary

GitHub owns event delivery and required-check enforcement.
Actionlint and Zizmor check workflow syntax and permission use.
Inspect the actual current-head jobs before merging.
The unchanged required predicate must reject failed or cancelled retained jobs.
Run the normal frontend gate, production build, and frozen installation with the migrated dependencies.
Retained hosted checks cover the browser and native Windows boundaries.
These observations don't prove the upstream runner or SDK implementations.
Revisit the job inventory if another desktop platform becomes a supported product or a concrete test gap needs targeted mutation analysis.

## Consequences

Ordinary updates use four product jobs once per PR.
They don't provision a Linux desktop environment or start two mutation campaigns.
Coverage thresholds and real browser and native acceptance remain mandatory.
The source README keeps the original-photo and binary licensing notices alongside the concise setup path.
