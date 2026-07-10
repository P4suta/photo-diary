// Polyfills for Web APIs missing in jsdom. ES module imports are hoisted, so this must
// run before modules that touch matchMedia at load time (e.g. theme.ts). Keep it as the
// *first* setupFile and import no app code.

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      // Legacy API, kept as a safety net (theme.ts uses addEventListener).
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
