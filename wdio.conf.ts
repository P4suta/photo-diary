import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { sep } from 'node:path'
import {
  nativeAppBinary,
  nativeDataDir,
  nativeE2eRoot,
  nativeFixtureDir,
  nativeScreenshotDir,
} from './native-e2e/paths'

export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: ['./native-e2e/library.spec.ts'],
  maxInstances: 1,
  capabilities: [
    {
      browserName: 'tauri',
    },
  ],
  services: [
    [
      '@wdio/tauri-service',
      {
        appBinaryPath: nativeAppBinary,
        driverProvider: 'embedded',
        embeddedPort: 4445,
        env: { PHOTO_DIARY_E2E_DATA_DIR: nativeDataDir },
        startTimeout: 90_000,
        statusPollTimeout: 10_000,
        commandTimeout: 60_000,
        captureBackendLogs: true,
        captureFrontendLogs: true,
        logDir: nativeE2eRoot,
      },
    ],
  ],
  framework: 'mocha',
  reporters: ['spec'],
  logLevel: 'error',
  waitforTimeout: 15_000,
  connectionRetryTimeout: 120_000,
  connectionRetryCount: 1,
  mochaOpts: { ui: 'bdd', timeout: 120_000 },
  onPrepare() {
    const allowedRoot = `${process.cwd()}${sep}test-results${sep}`
    if (!nativeE2eRoot.startsWith(allowedRoot)) {
      throw new Error(`Refusing to clear native E2E path outside test-results: ${nativeE2eRoot}`)
    }
    rmSync(nativeE2eRoot, { recursive: true, force: true })
    mkdirSync(nativeFixtureDir, { recursive: true })
    mkdirSync(nativeScreenshotDir, { recursive: true })
    copyFileSync('src-tauri/icons/64x64.png', `${nativeFixtureDir}${sep}IMG_0001.png`)
    writeFileSync(`${nativeFixtureDir}${sep}broken.jpg`, 'not an image')
    writeFileSync(`${nativeFixtureDir}${sep}unsupported.heic`, 'unsupported')
  },
}
