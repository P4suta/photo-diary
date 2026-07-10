// Strongly-typed t() keys: the `en` catalog is the source of truth for key shape.
import 'i18next'
import type en from '@/locales/en.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: typeof en }
  }
}
