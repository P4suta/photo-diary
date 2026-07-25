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
const extraArgs = process.argv.slice(3)
const patchFile = 'mutants-in-diff.patch'
// This mutation is byte-for-byte equivalent: the v0.1 resolver version constant is `1`.
// Keep the exclusion name-scoped so future resolver changes and every other mutation still run.
const equivalentMutantArgs = [
  '--exclude-re',
  'replace <impl PlaceResolver for OfflinePlaceResolver>::version -> i64 with 1$',
]

let diff
try {
  diff = execFileSync('git', ['diff', base, '--'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
    encoding: 'utf8',
  })
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^(crates\/.+|src-tauri\/src\/.+)\.rs$/.test(line))

  for (const file of untracked) {
    const patch = spawnSync('git', ['diff', '--no-index', '--', '/dev/null', file], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
    // `git diff --no-index` returns 1 when it successfully finds a difference.
    if (patch.status !== 0 && patch.status !== 1) {
      throw new Error(patch.stderr || `could not create a patch for ${file}`)
    }
    diff += `\n${patch.stdout}`
  }
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
  [
    'mutants',
    '--package',
    'photo-diary-core',
    '--jobs',
    '2',
    '--gitignore',
    'true',
    '--in-diff',
    patchFile,
    ...equivalentMutantArgs,
    ...extraArgs,
  ],
  { stdio: 'inherit' },
)
process.exit(result.status ?? 1)
