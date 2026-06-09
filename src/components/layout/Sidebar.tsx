export default function Sidebar() {
  return (
    <div className="flex flex-col h-full" style={{ color: 'var(--text-inverse)' }}>
      <div
        className="flex items-center px-5 flex-shrink-0"
        style={{
          height: 'var(--header-h)',
          borderBottom: '1px solid var(--blue-800)',
        }}
      >
        <span
          className="font-display font-semibold"
          style={{ fontSize: 'var(--text-md)', color: 'var(--text-inverse)' }}
        >
          LegalGraph
        </span>
      </div>
      <div className="flex-1 overflow-y-auto py-3" id="sidebar-session-list" />
      <div
        className="flex-shrink-0 px-4 py-3"
        style={{ borderTop: '1px solid var(--blue-800)' }}
        id="sidebar-user-menu"
      />
    </div>
  )
}
