import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
// vitest/config extends vite's defineConfig so the `test` field is typed.
import { configDefaults, defineConfig } from 'vitest/config'

// .ts tests that need a DOM (jsdom), so they're carved out of the node project and
// added to jsdom explicitly. Structural globs (below) handle everything else, so a
// new test file can never silently match zero projects.
const DOM_TS_TESTS = ['src/app/theme.test.ts']

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { port: 5173 },
  test: {
    // Splitting tests by environment mirrors the architecture's layers directly.
    //  - node   : pure domain / lib / contract / store (no DOM, lightweight and fast)
    //  - jsdom  : UI components / interaction / a11y (need React rendering)
    //
    // The split is structural, not a hand-maintained whitelist: every `.test.ts` runs
    // in node (except the DOM-needing carve-outs) and every `.test.tsx` runs in jsdom.
    // Their union is exactly `src/**/*.test.*` with no overlap, so a test file can
    // never silently belong to zero projects (or both).
    projects: [
      {
        extends: true, // inherit the root alias(@)/plugin
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          // .ts tests that need a DOM run in jsdom instead — keep the sets disjoint.
          exclude: [...configDefaults.exclude, ...DOM_TS_TESTS],
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          setupFiles: ['./src/test/polyfills.ts', './src/test/setup.ts'],
          include: ['src/**/*.test.tsx', ...DOM_TS_TESTS],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Exclude test assets, fixtures, entry points, and Tauri deps (not unit-testable in phase 1).
      exclude: [
        '**/*.test.{ts,tsx}',
        'src/test/**',
        'src/data/mock/fixtures.ts',
        'src/data/tauri/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'e2e/**',
      ],
      // Enforce thresholds only on the pure-logic layers (domain/lib). The UI is report-only, grown incrementally.
      thresholds: {
        'src/domain/**': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/lib/**': { statements: 90, branches: 90, functions: 90, lines: 90 },
      },
    },
  },
})
