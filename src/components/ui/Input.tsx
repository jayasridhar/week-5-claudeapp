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
