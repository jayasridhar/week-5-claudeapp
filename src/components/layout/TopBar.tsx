import { ReactNode } from 'react'

interface TopBarProps {
  title?: string
  aside?: ReactNode
}

export default function TopBar({ title = '', aside }: TopBarProps) {
  return (
    <header
      className="flex-shrink-0 flex items-center justify-between px-6"
      style={{
        height: 'var(--header-h)',
        backgroundColor: 'var(--surface-card)',
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      <span className="lg-h3 truncate">{title}</span>
      {aside && <div className="flex items-center gap-2">{aside}</div>}
    </header>
  )
}
