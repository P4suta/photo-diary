import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import en from '@/locales/en.json'
import ja from '@/locales/ja.json'

/** Bundled catalogs. `en` is the default/fallback and the source of key types. */
export const resources = {
  en: { translation: en },
  ja: { translation: ja },
} as const

export const supportedLngs = ['en', 'ja'] as const
export type Locale = (typeof supportedLngs)[number]

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: [...supportedLngs],
    detection: {
      // Never look at navigator: `en` is the shipping default until the user picks.
      order: ['localStorage'],
      lookupLocalStorage: 'photo-diary-locale',
      caches: ['localStorage'],
    },
    // `{{count, number}}` uses i18next's built-in Intl number formatter (locale-grouped).
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    returnNull: false,
  })

// Keep <html lang> in sync with the active locale.
if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.resolvedLanguage ?? 'en'
  i18n.on('languageChanged', (lng) => {
    document.documentElement.lang = lng
  })
}

export default i18n
