// Diff-only TS mutation driver.
//
// StrykerJS has no `--since`/git-diff filter, so we enumerate the domain/lib
// `.ts` files changed versus the base ref ourselves and hand them to Stryker's
// `--mutate`. Written as a node driver (not inline PowerShell) so it runs
// identically in sh (CI) and PowerShell (local Windows) — the same reason the
// `clean` recipe uses a node one-liner.
//
// Note the TS/Rust asymmetry: Stryker mutates whole *files*, so a one-line edit
// to a large file re-mutates that whole file (cargo-mutants, by contrast, is
// line-scoped via --in-diff). `incremental` in stryker.config.json reuses
// unchanged mutants to keep that cost down.
//
// Usage: node scripts/mutation-ts-diff.mjs [baseRef]   (default: origin/main)
import { execFileSync, spawnSync } from 'node:child_process'

const base = process.argv[2] ?? 'origin/main'

let changed
try {
  changed = execFileSync(
    'git',
    ['diff', '--name-only', '--diff-filter=d', `${base}...HEAD`],
    { encoding: 'utf8' },
  )
} catch (err) {
  console.error(`git diff against '${base}' failed: ${err.message}`)
  process.exit(1)
}

// Only the pure-logic layers Stryker is configured to mutate, excluding tests.
const files = changed
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => /^src\/(domain|lib)\/.+\.ts$/.test(line) && !line.endsWith('.test.ts'))

if (files.length === 0) {
  // Empty `--mutate` would fall back to mutating everything — early-exit instead.
  console.log('No domain/lib .ts changes vs base — skipping TS mutation.')
  process.exit(0)
}

console.log(`Mutating ${files.length} changed file(s):`)
for (const file of files) console.log(`  ${file}`)

const result = spawnSync('pnpm', ['exec', 'stryker', 'run', '--mutate', files.join(',')], {
  stdio: 'inherit',
  shell: true,
})
process.exit(result.status ?? 1)
