'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FileText, MessageSquare, History, Shield } from 'lucide-react'

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
            DocAssist
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
          Analyse any document in minutes
        </h1>
        <p className="text-[17px] text-an-fg-subtle leading-relaxed max-w-xl mx-auto mb-10">
          Upload a PDF or Word document and ask anything about it. Get accurate, cited answers from an AI that only uses what's in your document.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/signup"
            className="bg-an-accent hover:bg-an-accent-hover text-white font-medium text-[15px] px-6 py-2.5 rounded transition-colors duration-150"
          >
            Start for free
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
          Everything you need to understand your documents
        </h2>
        <p className="text-body text-an-fg-subtle text-center mb-12">
          Purpose-built for knowledge workers who review contracts, reports, and research.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              icon: FileText,
              title: 'Upload PDF or DOCX',
              description: 'Drop in any text-based PDF or Word document up to 10 MB. Your file is parsed client-side and never stored on our servers.',
            },
            {
              icon: MessageSquare,
              title: 'Ask anything',
              description: 'Ask questions in plain English. The AI answers strictly from your document — with source references — and flags when information is not present.',
            },
            {
              icon: History,
              title: 'Full session history',
              description: 'Every conversation is saved. Return to any session, continue where you left off, and review past Q&A at any time.',
            },
            {
              icon: Shield,
              title: 'Secure and grounded',
              description: 'Responses are grounded only in your document. The AI will not speculate or hallucinate content that is not there.',
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

      {/* Pricing */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-title text-center text-an-fg-base mb-2">Simple pricing</h2>
        <p className="text-body text-an-fg-subtle text-center mb-12">
          Start free. Upgrade when you need more.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            {
              name: 'Free trial',
              price: '$0',
              period: '14 days',
              features: ['5 document analyses', '1 user', 'Full chat history'],
              accent: false,
            },
            {
              name: 'Starter',
              price: '$29',
              period: 'per month',
              features: ['20 analyses', '1 user', 'Full chat history', 'Email support'],
              accent: false,
            },
            {
              name: 'Growth',
              price: '$79',
              period: 'per month',
              features: ['100 analyses', '5 users', 'Priority support', 'Session export'],
              accent: true,
            },
            {
              name: 'Pro',
              price: '$199',
              period: 'per month',
              features: ['Unlimited analyses', '20 users', 'Priority support', 'Advanced analytics'],
              accent: false,
            },
          ].map(({ name, price, period, features, accent }) => (
            <div
              key={name}
              className={`border rounded-lg p-6 flex flex-col ${
                accent
                  ? 'border-an-accent bg-an-accent-subtle'
                  : 'border-an-border bg-an-bg-subtle'
              }`}
            >
              {accent && (
                <span className="text-label text-an-accent uppercase tracking-wide mb-3">
                  Most popular
                </span>
              )}
              <div className="mb-4">
                <div className="text-[28px] font-semibold text-an-fg-base font-display">
                  {price}
                </div>
                <div className="text-caption text-an-fg-muted">{period}</div>
              </div>
              <div className="text-[15px] font-medium text-an-fg-base mb-4">{name}</div>
              <ul className="space-y-2 flex-1 mb-6">
                {features.map((f) => (
                  <li key={f} className="text-body text-an-fg-subtle flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-an-accent flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={`text-center text-label py-2 rounded transition-colors duration-150 ${
                  accent
                    ? 'bg-an-accent hover:bg-an-accent-hover text-white'
                    : 'bg-an-bg-surface hover:bg-an-bg-elevated text-an-fg-base border border-an-border'
                }`}
              >
                Get started
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-6xl mx-auto px-6 py-16 text-center">
        <h2 className="font-display text-[32px] font-semibold text-an-fg-base mb-4">
          Ready to analyse your first document?
        </h2>
        <p className="text-body text-an-fg-subtle mb-8">
          No credit card required. Start with 5 free analyses.
        </p>
        <Link
          href="/signup"
          className="inline-block bg-an-accent hover:bg-an-accent-hover text-white font-medium text-[15px] px-8 py-3 rounded transition-colors duration-150"
        >
          Create a free account
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-an-border">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
          <span className="font-display text-[15px] font-medium text-an-fg-base">DocAssist</span>
          <p className="text-caption text-an-fg-muted">
            AI-generated analysis only. Always consult a qualified professional before acting on findings.
          </p>
        </div>
      </footer>
    </div>
  )
}
