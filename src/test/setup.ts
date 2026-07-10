// jsdom project setupFiles (evaluated after polyfills.ts). matchMedia and other
// polyfills are already in place here, so theme.ts / i18n.ts import safely.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, expect } from 'vitest'
// vitest-axe 0.1.0 ships an empty extend-expect.js (bug), so register the matcher
// ourselves. Its type declares the matcher type-only, so a value import trips
// verbatimModuleSyntax — pull it in via a namespace import + cast (types live in
// src/test/vitest.d.ts).
import * as axeMatchers from 'vitest-axe/matchers'
import i18n from '@/app/i18n'
import { useTheme } from '@/app/theme'
import { useUi } from '@/app/ui-store'

// biome-ignore lint/suspicious/noExplicitAny: works around vitest-axe's broken type declaration
expect.extend(axeMatchers as any)

// zustand stores are module singletons; reset to initial state so nothing leaks
// between tests.
const uiInitial = useUi.getInitialState()
const themeInitial = useTheme.getInitialState()

beforeEach(() => {
  useUi.setState(uiInitial, true)
  useTheme.setState(themeInitial, true)
  // Default every test to the shipping locale (`en`); the settings test may switch it.
  localStorage.removeItem('photo-diary-locale')
  if (i18n.language !== 'en') i18n.changeLanguage('en')
})

afterEach(() => {
  cleanup()
})
