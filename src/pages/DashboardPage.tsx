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
