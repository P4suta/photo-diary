// vitest-axe 0.1.0's type augmentation targets the old `Vi.Assertion` namespace and
// has no effect in vitest 4. Augment the `vitest` module's Assertion ourselves to type
// the matcher.
import type { AxeResults } from 'axe-core'
import 'vitest'

interface AxeMatchers<R = unknown> {
  toHaveNoViolations: () => R
}

declare module 'vitest' {
  interface Assertion<T = AxeResults> extends AxeMatchers<T> {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
