import { ReactNode } from 'react'

type BadgeVariant = 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger'

interface BadgeProps {
  variant?: BadgeVariant
  dot?: boolean
  children: ReactNode
}

const variantMap: Record<BadgeVariant, { bg: string; color: string; border: string }> = {
  neutral: { bg: 'var(--surface-sunken)', color: 'var(--text-secondary)', border: 'var(--border-default)' },
  primary: { bg: 'var(--blue-50)', color: 'var(--blue-700)', border: 'var(--blue-100)' },
  accent: { bg: 'var(--brass-100)', color: 'var(--brass-600)', border: 'var(--brass-300)' },
  success: { bg: 'var(--safe-bg)', color: 'var(--safe-fg)', border: 'var(--safe-border)' },
  warning: { bg: 'var(--warn-bg)', color: 'var(--warn-fg)', border: 'var(--warn-border)' },
  danger: { bg: 'var(--danger-bg)', color: 'var(--danger-fg)', border: 'var(--danger-border)' },
}

export default function Badge({ variant = 'neutral', dot = false, children }: BadgeProps) {
  const { bg, color, border } = variantMap[variant]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        backgroundColor: bg,
        color,
        border: `1px solid ${border}`,
        borderRadius: 'var(--radius-pill)',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-2xs)',
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: color,
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  )
}
