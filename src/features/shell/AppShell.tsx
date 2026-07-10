import { Navigate, Outlet } from 'react-router-dom'
import { useFolders } from '@/app/queries'
import { ImportOverlay } from '@/features/import/ImportOverlay'
import { Lightbox } from '@/features/lightbox/Lightbox'
import { Sidebar } from './Sidebar'
import { Toast } from './Toast'
import { TopBar } from './TopBar'

export function AppShell() {
  // First run: a library with no watched folder has nothing to show, so send it to
  // onboarding. While folders are still loading (undefined) render the shell as usual.
  const { data: folders } = useFolders()
  if (folders && folders.length === 0) return <Navigate to="/welcome" replace />

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1 min-h-0 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <Lightbox />
      <ImportOverlay />
      <Toast />
    </div>
  )
}
