'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BarChart2, CreditCard, Shield } from 'lucide-react'

export default function LandingPage() {
  const router = useRouter()

  useEffect(() => {
    const userId = localStorage.getItem('userId')
    if (userId) router.replace('/dashboard')
  }, [router])

  return (
    <div data-theme="light" className="min-h-screen bg-an-bg-base text-an-fg-base">
      {/* Nav */}
      <nav className="border-b border-an-border sticky top-0 bg-an-bg-base/90 backdrop-blur-sm z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-display text-[17px] font-semibold text-an-fg-base">
            Birchmont Capital Fusion
          </span>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-label text-an-fg-subtle hover:text-an-fg-base transition-colors duration-100 px-3 py-1.5"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-label bg-an-accent hover:bg-an-accent-hover text-white px-4 py-1.5 rounded transition-colors duration-150"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-an-accent-subtle text-an-accent text-label px-3 py-1 rounded-full mb-8">
          Powered by Azure AI
        </div>
        <h1 className="font-display text-[52px] font-semibold leading-[1.15] text-an-fg-base mb-6 max-w-3xl mx-auto">
          Financial intelligence for capital decisions
        </h1>
        <p className="text-[17px] text-an-fg-subtle leading-relaxed max-w-xl mx-auto mb-10">
          Upload a financial statement and get a full normalized analysis — balance sheet, income statement, cash flow, and credit readiness — in minutes.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/signup"
            className="bg-an-accent hover:bg-an-accent-hover text-white font-medium text-[15px] px-6 py-2.5 rounded transition-colors duration-150"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="text-an-fg-subtle hover:text-an-fg-base text-[15px] font-medium transition-colors duration-100"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-title text-center text-an-fg-base mb-2">
          Two tools. One platform.
        </h2>
        <p className="text-body text-an-fg-subtle text-center mb-12">
          Purpose-built for analysts and advisors who need fast, accurate financial assessments.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: BarChart2,
              title: 'Financial Analysis',
              description: 'Upload a PDF financial statement and receive a normalized breakdown including balance sheet, income statement, cash flow, vertical and horizontal analysis, and 5-year projections.',
            },
            {
              icon: CreditCard,
              title: 'Credit Readiness',
              description: 'Assess credit readiness based on normalized financial data. Run directly after a financial analysis or paste your own data to get a full credit assessment.',
            },
            {
              icon: Shield,
              title: 'Secure and grounded',
              description: 'Responses are grounded in your financial data. The AI will not speculate or generate figures that are not supported by the uploaded document.',
            },
          ].map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="bg-an-bg-subtle border border-an-border rounded-lg p-6"
            >
              <div className="w-8 h-8 bg-an-accent-subtle rounded flex items-center justify-center mb-4">
                <Icon size={16} className="text-an-accent" strokeWidth={1.5} />
              </div>
              <h3 className="text-[15px] font-medium text-an-fg-base mb-2">{title}</h3>
              <p className="text-body text-an-fg-subtle">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-6xl mx-auto px-6 py-16 text-center">
        <h2 className="font-display text-[32px] font-semibold text-an-fg-base mb-4">
          Ready to run your first analysis?
        </h2>
        <p className="text-body text-an-fg-subtle mb-8">
          Sign up and start analysing financial statements immediately.
        </p>
        <Link
          href="/signup"
          className="inline-block bg-an-accent hover:bg-an-accent-hover text-white font-medium text-[15px] px-8 py-3 rounded transition-colors duration-150"
        >
          Create an account
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-an-border">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
          <span className="font-display text-[15px] font-medium text-an-fg-base">Birchmont Capital Fusion</span>
          <p className="text-caption text-an-fg-muted">
            AI-generated analysis only. Always consult a qualified professional before acting on findings.
          </p>
        </div>
      </footer>
    </div>
  )
}
