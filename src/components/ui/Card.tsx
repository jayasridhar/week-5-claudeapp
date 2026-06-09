import { ReactNode } from 'react'

interface CardProps {
  title?: ReactNode
  subtitle?: ReactNode
  aside?: ReactNode
  footer?: ReactNode
  children: ReactNode
  variant?: 'default' | 'flat' | 'interactive'
  style?: React.CSSProperties
  onClick?: () => void
}

export default function Card({
  title,
  subtitle,
  aside,
  footer,
  children,
  variant = 'default',
  style,
  onClick,
}: CardProps) {
  const isInteractive = variant === 'interactive' || !!onClick
  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: 'var(--surface-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: variant === 'flat' ? 'none' : 'var(--shadow-sm)',
        overflow: 'hidden',
        cursor: isInteractive ? 'pointer' : undefined,
        transition: isInteractive ? 'var(--transition-control)' : undefined,
        ...style,
      }}
      onMouseEnter={isInteractive ? (e) => {
        const el = e.currentTarget
        el.style.transform = 'translateY(-2px)'
        el.style.boxShadow = 'var(--shadow-md)'
      } : undefined}
      onMouseLeave={isInteractive ? (e) => {
        const el = e.currentTarget
        el.style.transform = 'translateY(0)'
        el.style.boxShadow = 'var(--shadow-sm)'
      } : undefined}
    >
      {(title || aside) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-4) var(--space-5)',
          borderBottom: '1px solid var(--border-soft)',
        }}>
          <div>
            {title && <div className="lg-h3">{title}</div>}
            {subtitle && <div className="lg-small">{subtitle}</div>}
          </div>
          {aside}
        </div>
      )}
      <div style={{ padding: 'var(--space-5)' }}>{children}</div>
      {footer && (
        <div style={{
          padding: 'var(--space-3) var(--space-5)',
          backgroundColor: 'var(--surface-sunken)',
          borderTop: '1px solid var(--border-soft)',
        }}>
          {footer}
        </div>
      )}
    </div>
  )
}
