import { RouterProvider } from 'react-router-dom'
import { ImportOverlay } from '@/features/import/ImportOverlay'
import { Lightbox } from '@/features/lightbox/Lightbox'
import { Providers } from './providers'
import { router } from './router'

export function App() {
  // App-global overlays live here, not in AppShell: they are cross-feature (import,
  // lightbox) and self-contained (fixed position, no router hooks), so composing them
  // at the app root keeps the shell free of feature→feature imports.
  return (
    <Providers>
      <RouterProvider router={router} />
      <Lightbox />
      <ImportOverlay />
    </Providers>
  )
}
