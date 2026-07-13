import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        an: {
          'bg-base':      'var(--an-bg-base)',
          'bg-subtle':    'var(--an-bg-subtle)',
          'bg-surface':   'var(--an-bg-surface)',
          'bg-elevated':  'var(--an-bg-elevated)',
          'border':       'var(--an-border-base)',
          'border-strong':'var(--an-border-strong)',
          'fg-base':      'var(--an-fg-base)',
          'fg-subtle':    'var(--an-fg-subtle)',
          'fg-muted':     'var(--an-fg-muted)',
          'fg-inverted':  'var(--an-fg-inverted)',
          'accent':       'var(--an-accent)',
          'accent-hover': 'var(--an-accent-hover)',
          'accent-subtle':'var(--an-accent-subtle)',
          'success':      'var(--an-success)',
          'warning':      'var(--an-warning)',
          'error':        'var(--an-error)',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Lora', 'Georgia', 'serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'display': ['28px', { lineHeight: '1.2', fontWeight: '500' }],
        'title':   ['18px', { lineHeight: '1.3', fontWeight: '500' }],
        'body':    ['14px', { lineHeight: '1.6', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '1.5', fontWeight: '400' }],
        'caption': ['12px', { lineHeight: '1.4', fontWeight: '400' }],
        'mono':    ['13px', { lineHeight: '1.6', fontWeight: '400' }],
        'label':   ['12px', { lineHeight: '1',   fontWeight: '500' }],
      },
      borderRadius: {
        DEFAULT: '6px',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        '100': '100ms',
        '150': '150ms',
      },
    },
  },
  plugins: [],
}

export default config
