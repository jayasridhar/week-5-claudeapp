import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DocAssist — AI Document Analysis',
  description: 'Upload any document and get instant AI-powered analysis and answers.',
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
