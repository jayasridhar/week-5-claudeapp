'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BarChart2, CreditCard, ArrowRight } from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()

  useEffect(() => {
    const userId = localStorage.getItem('userId')
    if (!userId) router.replace('/login')
  }, [router])

  const features = [
    {
      href: '/dashboard/financial',
      icon: BarChart2,
      title: 'Financial Analysis',
      description: 'Upload a financial statement PDF and get a normalized breakdown — balance sheet, income statement, cash flow, vertical and horizontal analysis, and 5-year projections.',
      cta: 'Run financial analysis',
    },
    {
      href: '/dashboard/credit',
      icon: CreditCard,
      title: 'Credit Readiness',
      description: 'Assess credit readiness based on normalized financial data. Run directly after a financial analysis or paste your own data to get a full credit assessment.',
      cta: 'Run credit readiness',
    },
  ]

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-10">
          <h1 className="text-display text-an-fg-base mb-2">Welcome to Birchmont Capital Fusion</h1>
          <p className="text-body text-an-fg-subtle">Select a tool to get started.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map(({ href, icon: Icon, title, description, cta }) => (
            <div key={href} className="bg-an-bg-surface border border-an-border rounded-lg p-6 flex flex-col gap-4">
              <div className="w-10 h-10 rounded-lg bg-an-accent-subtle flex items-center justify-center">
                <Icon size={20} strokeWidth={1.5} className="text-an-accent" />
              </div>
              <div className="flex-1">
                <h2 className="text-title text-an-fg-base mb-2">{title}</h2>
                <p className="text-body-sm text-an-fg-subtle leading-relaxed">{description}</p>
              </div>
              <Link
                href={href}
                className="h-9 px-4 bg-an-accent hover:bg-an-accent-hover text-white text-label rounded transition-colors duration-150 flex items-center gap-2 w-fit"
              >
                {cta}
                <ArrowRight size={13} strokeWidth={2} />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
