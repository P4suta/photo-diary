import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import process from 'node:process'

const wdioCli = resolve('node_modules', '@wdio', 'cli', 'bin', 'wdio.js')

for (const config of ['wdio.conf.ts', 'wdio.restart.conf.ts']) {
  const result = spawnSync(process.execPath, [wdioCli, 'run', config], {
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
