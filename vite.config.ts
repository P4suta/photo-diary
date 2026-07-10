import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
// vitest/config extends vite's defineConfig so the `test` field is typed.
import { defineConfig } from 'vitest/config'

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
    projects: [
      {
        extends: true, // inherit the root alias(@)/plugin
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'src/domain/**/*.test.ts',
            'src/lib/**/*.test.ts',
            'src/features/calendar/heat.test.ts',
            'src/data/**/*.test.ts',
            'src/app/ui-store.test.ts',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          setupFiles: ['./src/test/polyfills.ts', './src/test/setup.ts'],
          include: ['src/**/*.test.tsx', 'src/app/theme.test.ts', 'src/app/queries.test.tsx'],
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
