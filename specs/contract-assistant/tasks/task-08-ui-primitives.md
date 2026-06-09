# Task 08: UI Primitive Components

## Status

complete

## Wave

2

## Description

Build the shared UI primitive components that are used across the app: `Button`, `Input`, `Card`, and `Badge`. All four follow the LegalGraph design system (warm ivory, ink-blue primary, brass accent, Spectral/IBM Plex fonts, warm shadow tokens). These are the only components allowed in `src/components/ui/` — all feature-specific components live in their own directories. This task runs in parallel with task-04, task-05, task-06, task-07.

## Dependencies

**Depends on:** task-01-typescript-tailwind, task-02-design-tokens
**Blocks:** task-09-auth-pages, task-11-chat-components

**Context from dependencies:**
- task-01 converted the project to TypeScript. All files here are `.tsx`.
- task-02 defined all CSS custom properties in `src/tokens/*.css` and imported them globally. Available tokens: `--brand-primary`, `--brand-primary-hover`, `--brand-accent`, `--text-body`, `--text-strong`, `--surface-card`, `--border-default`, `--radius-md`, `--shadow-sm`, `--transition-control`, etc. Tailwind config in `tailwind.config.ts` maps these variables to class names like `bg-primary`, `text-text-body`, `rounded-md`, etc.

## Files to Create

- `src/components/ui/Button.tsx` — variant-aware button (primary, secondary, ghost, danger)
- `src/components/ui/Input.tsx` — labeled text input with error and hint states
- `src/components/ui/Card.tsx` — surface card with optional title and footer
- `src/components/ui/Badge.tsx` — small status pill

## Technical Details

### Button.tsx

```tsx
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
    color: '#fff',
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
        cursor: disabled || loading ? 'not-allowed',
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
```

### Input.tsx

```tsx
import { InputHTMLAttributes, useId } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
}

export default function Input({ label, hint, error, style, ...rest }: InputProps) {
  const id = useId()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label
          htmlFor={id}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            color: 'var(--text-strong)',
          }}
        >
          {label}
        </label>
      )}
      <input
        id={id}
        style={{
          width: '100%',
          padding: '10px 14px',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-base)',
          color: 'var(--text-body)',
          backgroundColor: 'var(--surface-raised)',
          border: `1px solid ${error ? 'var(--danger-fg)' : 'var(--border-default)'}`,
          borderRadius: 'var(--radius-md)',
          outline: 'none',
          boxShadow: 'var(--shadow-inset)',
          transition: 'border-color var(--dur-fast) var(--ease-out)',
          ...style,
        }}
        onFocus={(e) => {
          e.target.style.borderColor = 'var(--border-focus)'
          e.target.style.boxShadow = 'var(--ring)'
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? 'var(--danger-fg)' : 'var(--border-default)'
          e.target.style.boxShadow = 'var(--shadow-inset)'
        }}
        {...rest}
      />
      {error && (
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--danger-fg)' }}>{error}</span>
      )}
      {!error && hint && (
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{hint}</span>
      )}
    </div>
  )
}
```

### Card.tsx

```tsx
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
```

### Badge.tsx

```tsx
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
```

## Acceptance Criteria

- [ ] `Button` renders in all four variants with correct background colors from design tokens
- [ ] `Button` with `disabled={true}` is visually dimmed and not clickable
- [ ] `Input` shows red border when `error` prop is set, and focus ring when focused
- [ ] `Card` with `variant="interactive"` lifts on hover (translateY + shadow)
- [ ] `Badge` renders all six variants with correct warm color palette
- [ ] All four components are TypeScript-strict with no `any` types
- [ ] `npx tsc --noEmit` passes

## Notes

- These components use inline `style` props with CSS variable references rather than Tailwind utility classes for color/typography — this keeps them tightly coupled to the design token system.
- The `cursor` property in Button has a syntax error in the snippet above — fix it: `cursor: disabled || loading ? 'not-allowed' : 'pointer'` (ternary needs a second branch).
- Do NOT add Storybook, tests, or a component index barrel file — keep it minimal.
