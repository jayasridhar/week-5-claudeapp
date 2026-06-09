import { ReactNode } from 'react'
import Sidebar from './Sidebar'

interface AppShellProps {
  sidebar?: ReactNode
  children: ReactNode
}

export default function AppShell({ sidebar, children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--surface-canvas)' }}>
      <aside
        className="flex-shrink-0 h-full overflow-y-auto"
        style={{
          width: 'var(--sidebar-w)',
          minWidth: 'var(--sidebar-w)',
          backgroundColor: 'var(--surface-inverse)',
          borderRight: '1px solid var(--blue-800)',
        }}
      >
        {sidebar ?? <Sidebar />}
      </aside>
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {children}
      </main>
    </div>
  )
}
