import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
// vitest/config extends vite's defineConfig so the `test` field is typed.
import { configDefaults, defineConfig } from 'vitest/config'

// .ts tests that need a DOM (jsdom), so they're carved out of the node project and
// added to jsdom explicitly. Structural globs (below) handle everything else, so a
// new test file can never silently match zero projects.
const DOM_TS_TESTS = ['src/app/theme.test.ts']

function nativeE2eEntry(mode: string): Plugin {
  return {
    name: 'photo-diary:native-e2e-entry',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return mode === 'native-e2e' ? html.replace('/src/main.tsx', '/src/native-e2e.ts') : html
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [nativeE2eEntry(mode), react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Vite otherwise crawls every HTML file below the repository, including
  // Tauri-generated HTML under target/. The application has one browser entry.
  optimizeDeps: { entries: ['index.html'] },
  server: {
    port: 5173,
    // Native builds and acceptance runs create large generated trees. They are
    // never frontend inputs and must not consume Windows filesystem handles.
    watch: {
      ignored: [
        '**/target/**',
        '**/_handoff/**',
        '**/reports/**',
        '**/test-results/**',
        '**/playwright-report/**',
      ],
    },
  },
  test: {
    // Windows can otherwise attempt to spawn one jsdom worker per test file and
    // intermittently exhaust desktop-process resources. Two workers keeps the
    // verification gate deterministic without serializing the whole suite.
    maxWorkers: 2,
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
      // Exclude test assets, fixtures, entry points, and Tauri-only adapters.
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
}))
