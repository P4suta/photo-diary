import { Outlet } from 'react-router-dom'
import { ImportOverlay } from '@/features/import/ImportOverlay'
import { Lightbox } from '@/features/lightbox/Lightbox'
import { Sidebar } from './Sidebar'
import { Toast } from './Toast'
import { TopBar } from './TopBar'

export function AppShell() {
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
