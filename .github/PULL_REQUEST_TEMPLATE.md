<!--
Thanks for contributing! A few reminders (see CONTRIBUTING.md for the full loop):
- Commits follow Conventional Commits (feat: / fix: / perf: / docs: / …); PRs are squash-merged.
- Don't hardcode colors/accents — go through the design tokens in src/index.css.
-->

## What & why

Describe the change and the motivation. Link any related issue (`Closes #123`).

## Linear

Closes DEV-___
<!-- Links this PR to its Linear issue; requires the Linear GitHub integration. -->

## Checklist

- [ ] `just check` passes (typecheck, Biome, typos, coverage thresholds)
- [ ] `just check-rust` passes if Rust (`crates/photo-diary-core` / `src-tauri`) changed
      (cargo test + clippy `-D warnings` + `fmt --check`)
- [ ] New or changed product code is covered by a test that pins its behavior
      (the `mutation` CI gate mutation-tests the diff)
- [ ] Docs / CHANGELOG updated if user-facing
