// Diff-only Rust mutation driver.
//
// Writes a git patch of the changes versus the base ref and passes it to
// cargo-mutants' `--in-diff`, which mutates only the changed lines (line-scoped,
// unlike the whole-file TS side). A node driver so it runs the same in sh (CI)
// and PowerShell (local Windows), like the `clean` recipe.
//
// An empty/Rust-free diff yields zero mutants and exits 0. cargo-mutants exits 2
// if any mutant survives (the pass/fail gate — there is no percentage threshold).
//
// Usage: node scripts/mutation-rust-diff.mjs [baseRef]   (default: origin/main)
import { execFileSync, spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const base = process.argv[2] ?? 'origin/main'
const patchFile = 'mutants-in-diff.patch'

let diff
try {
  diff = execFileSync('git', ['diff', `${base}...HEAD`], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
} catch (err) {
  console.error(`git diff against '${base}' failed: ${err.message}`)
  process.exit(1)
}

if (diff.trim() === '') {
  console.log('Empty diff vs base — skipping Rust mutation.')
  process.exit(0)
}

writeFileSync(patchFile, diff)

const result = spawnSync(
  'cargo',
  ['mutants', '--package', 'photo-diary-core', '--in-diff', patchFile],
  { stdio: 'inherit', shell: true },
)
process.exit(result.status ?? 1)
