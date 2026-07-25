import { resolve } from 'node:path'

export const nativeE2eRoot = resolve('test-results', 'native-e2e')
export const nativeDataDir = resolve(nativeE2eRoot, 'data')
export const nativeFixtureDir = resolve(nativeE2eRoot, 'fixtures')
export const nativeScreenshotDir = resolve(nativeE2eRoot, 'screenshots')
export const nativeExportPath = resolve(nativeE2eRoot, 'exported.avif')
export const nativeStatePath = resolve(nativeE2eRoot, 'restart-state.json')
export const nativeAppBinary = resolve('target', 'release', 'photo-diary.exe')
