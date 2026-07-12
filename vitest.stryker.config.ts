import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// Stryker-only vitest config. The main vite.config.ts splits tests into a node
// and a jsdom project (`projects[]`); the Stryker vitest runner does not
// officially support that split. The mutation targets (domain/lib) are covered
// entirely by `.test.ts` files that run in the node environment, so here we use
// a single flat node config with just those tests. `pool: 'threads'` is required
// by the vitest runner. Keep the `@` alias in sync with vite.config.ts.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/domain/**/*.test.ts', 'src/lib/**/*.test.ts'],
    pool: 'threads',
  },
})
