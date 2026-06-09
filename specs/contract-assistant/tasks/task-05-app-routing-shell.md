# Task 05: App Routing + Shell Layout

## Status

complete

## Wave

2

## Description

Set up React Router v6 with two routes (`/auth` and `/`), and build the visual skeleton of the app: the top-level `App.tsx` router, the `AppShell` two-column layout, a structural `Sidebar` (empty for now), a `TopBar`, and a skeleton `DashboardPage`. This establishes the spatial structure every subsequent task slots components into. Do NOT import from `src/components/ui/` — those primitives are built in task-08 which runs in parallel. Use basic styled HTML elements for anything visual in this task.

## Dependencies

**Depends on:** task-01-typescript-tailwind, task-02-design-tokens
**Blocks:** task-09-auth-pages, task-10-session-context, task-12-dashboard-integration

**Context from dependencies:**
- task-01 installed `react-router-dom` v6, converted the project to TypeScript, and added Tailwind. The `src/App.tsx` currently renders an empty placeholder div.
- task-02 created all CSS custom property tokens (colors, spacing, typography) in `src/tokens/*.css` and imported them in `src/index.css`. Tailwind utility classes reference these via `tailwind.config.ts` (e.g. `bg-canvas`, `text-text-body`, `bg-inverse`).

## Files to Create

- `src/components/layout/AppShell.tsx` — two-column layout: fixed sidebar + fluid main area
- `src/components/layout/Sidebar.tsx` — 264px left sidebar with LegalGraph dark chrome (structural skeleton only)
- `src/components/layout/TopBar.tsx` — 64px top bar inside the main area
- `src/pages/DashboardPage.tsx` — dashboard page skeleton (renders AppShell with placeholder content)

## Files to Modify

- `src/App.tsx` — replace placeholder div with BrowserRouter + route declarations

## Technical Details

### Implementation Steps

1. Update `src/App.tsx` with React Router:
```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<div className="min-h-screen bg-canvas" />} />
        <Route path="/" element={<DashboardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
```
The `/auth` route is a placeholder div — it will be replaced by task-09 (AuthPage).

2. Create `src/components/layout/AppShell.tsx`:
```tsx
import { ReactNode } from 'react'
import Sidebar from './Sidebar'

interface AppShellProps {
  sidebar?: ReactNode
  children: ReactNode
}

export default function AppShell({ sidebar, children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <aside
        style={{ width: 'var(--sidebar-w)', minWidth: 'var(--sidebar-w)' }}
        className="flex-shrink-0 h-full overflow-y-auto border-r"
        style={{
          width: 'var(--sidebar-w)',
          minWidth: 'var(--sidebar-w)',
          backgroundColor: 'var(--surface-inverse)',
          borderColor: 'var(--blue-800)',
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
```

Note: if the `style` prop with CSS variables conflicts with Tailwind classes of the same property, use only the `style` prop for those properties. Example: don't set `backgroundColor` both in `style` and via `className`.

3. Create `src/components/layout/Sidebar.tsx` — structural skeleton only. Later tasks (task-09, task-10) will fill in content:
```tsx
export default function Sidebar() {
  return (
    <div className="flex flex-col h-full" style={{ color: 'var(--text-inverse)' }}>
      {/* Logo area */}
      <div
        className="flex items-center px-5 flex-shrink-0"
        style={{
          height: 'var(--header-h)',
          borderBottom: '1px solid var(--blue-800)',
        }}
      >
        <span
          className="font-display font-semibold tracking-tight"
          style={{ fontSize: 'var(--text-md)', color: 'var(--text-inverse)' }}
        >
          LegalGraph
        </span>
      </div>

      {/* Session list area — filled by task-10 */}
      <div className="flex-1 overflow-y-auto py-3" id="sidebar-session-list" />

      {/* User menu area — filled by task-09 */}
      <div
        className="flex-shrink-0 px-4 py-3"
        style={{ borderTop: '1px solid var(--blue-800)' }}
        id="sidebar-user-menu"
      />
    </div>
  )
}
```

4. Create `src/components/layout/TopBar.tsx`:
```tsx
interface TopBarProps {
  title?: string
  aside?: React.ReactNode
}

export default function TopBar({ title = '', aside }: TopBarProps) {
  return (
    <header
      className="flex-shrink-0 flex items-center justify-between px-6 border-b"
      style={{
        height: 'var(--header-h)',
        backgroundColor: 'var(--surface-card)',
        borderColor: 'var(--border-default)',
      }}
    >
      <span className="lg-h3 truncate">{title}</span>
      {aside && <div className="flex items-center gap-2">{aside}</div>}
    </header>
  )
}
```

5. Create `src/pages/DashboardPage.tsx` — skeleton with AppShell:
```tsx
import AppShell from '../components/layout/AppShell'
import TopBar from '../components/layout/TopBar'

export default function DashboardPage() {
  return (
    <AppShell>
      <TopBar title="Contract Assistant" />
      <div
        className="flex-1 flex items-center justify-center"
        style={{ color: 'var(--text-secondary)' }}
      >
        <p className="lg-body">Select or create a chat session to begin.</p>
      </div>
    </AppShell>
  )
}
```

### Layout Dimensions

- Sidebar width: `264px` (from `--sidebar-w` token)
- TopBar height: `64px` (from `--header-h` token)
- Sidebar background: `--surface-inverse` (`#16263F` deep ink-blue)
- Main background: `--surface-canvas` (ivory)

## Acceptance Criteria

- [ ] Navigating to `/` renders the dashboard shell (sidebar + main area)
- [ ] Navigating to `/auth` renders a blank ivory page (placeholder)
- [ ] Navigating to `/unknown` redirects to `/`
- [ ] Sidebar has the dark ink-blue background (`#16263F`) and shows "LegalGraph" wordmark
- [ ] TopBar is 64px tall with the card background and a bottom border
- [ ] Layout does not scroll the full page — sidebar and main are full-height with internal scrolling
- [ ] `npx tsc --noEmit` passes

## Notes

- Do not import anything from `src/components/ui/` — task-08 creates those and runs in parallel with this task.
- Do not import from `src/store/` or `src/lib/` — those are task-04 and run in parallel. No auth wiring here.
- The `id` attributes on sidebar placeholder divs (`sidebar-session-list`, `sidebar-user-menu`) are just structural markers — later tasks will replace those divs with real components, not inject into them by ID.
