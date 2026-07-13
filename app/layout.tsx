import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Birchmont Capital Fusion',
  description: 'AI-powered financial analysis and credit readiness for capital decisions.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-an-bg-base text-an-fg-base font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
