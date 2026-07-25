import { existsSync } from 'node:fs'
import { nativeStatePath } from './native-e2e/paths'
import { config as baseConfig } from './wdio.conf'

export const config: WebdriverIO.Config = {
  ...baseConfig,
  specs: ['./native-e2e/restart.spec.ts'],
  onPrepare() {
    if (!existsSync(nativeStatePath)) {
      throw new Error(`The first native E2E session did not write ${nativeStatePath}`)
    }
  },
}
