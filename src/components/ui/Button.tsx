import { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  iconLeft?: ReactNode
  iconRight?: ReactNode
  loading?: boolean
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    backgroundColor: 'var(--brand-primary)',
    color: 'var(--text-on-primary)',
    border: '1px solid var(--brand-primary)',
  },
  secondary: {
    backgroundColor: 'transparent',
    color: 'var(--brand-primary)',
    border: '1px solid var(--brand-primary)',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: 'var(--text-body)',
    border: '1px solid transparent',
  },
  danger: {
    backgroundColor: 'var(--danger-fg)',
    color: 'var(--text-on-primary)',
    border: '1px solid var(--danger-fg)',
  },
  accent: {
    backgroundColor: 'var(--brand-accent)',
    color: 'var(--text-on-primary)',
    border: '1px solid var(--brand-accent)',
  },
}

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '6px 12px', fontSize: 'var(--text-sm)' },
  md: { padding: '10px 20px', fontSize: 'var(--text-sm)' },
  lg: { padding: '12px 24px', fontSize: 'var(--text-base)' },
}

export default function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  iconLeft,
  iconRight,
  loading = false,
  disabled,
  children,
  style,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      style={{
        ...variantStyles[variant],
        ...sizeStyles[size],
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: block ? '100%' : undefined,
        borderRadius: 'var(--radius-md)',
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.6 : 1,
        transition: 'var(--transition-control)',
        outline: 'none',
        ...style,
      }}
      {...rest}
    >
      {iconLeft}
      {loading ? 'Loading…' : children}
      {iconRight}
    </button>
  )
}
