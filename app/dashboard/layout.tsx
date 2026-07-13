'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import RightPanel from '@/components/RightPanel'
import { DashboardContext, INITIAL_STEPS } from '@/lib/DashboardContext'
import type { FilePreview, ExecutionStep } from '@/lib/DashboardContext'
import type { SessionRow } from '@/lib/db'

function DashboardInner({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null)
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>(INITIAL_STEPS)
  const [isProcessing, setIsProcessing] = useState(false)
  const [azureConnected, setAzureConnected] = useState(false)
  const [oauthError, setOauthError] = useState('')

  useEffect(() => {
    const userId = localStorage.getItem('userId')
    if (!userId) { router.replace('/login'); return }

    const error = searchParams.get('error')
    if (error === 'oauth_failed') setOauthError('Microsoft sign-in failed. Please try again.')
    if (error === 'token_exchange_failed') setOauthError('Could not get an Azure token. Check your app registration and try again.')

    fetch(`/api/sessions?userId=${userId}`)
      .then(r => r.json())
      .then((data: SessionRow[]) => setSessions(data))
      .catch(() => {})

    setAzureConnected(true)
  }, [router, searchParams])

  return (
    <DashboardContext.Provider value={{
      sessions, setSessions,
      filePreview, setFilePreview,
      executionSteps, setExecutionSteps,
      isProcessing, setIsProcessing,
      azureConnected, setAzureConnected,
    }}>
      <div className="flex h-screen overflow-hidden bg-an-bg-base">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
          {oauthError && (
            <div className="flex-shrink-0 flex items-center gap-3 px-6 py-2.5 bg-an-error/10 border-b border-an-error/20">
              <span className="text-body-sm text-an-error flex-1">{oauthError}</span>
              <button
                onClick={() => setOauthError('')}
                className="text-body-sm text-an-error hover:text-an-fg-base transition-colors"
              >
                Dismiss
              </button>
            </div>
          )}
          {children}
        </main>
        <RightPanel />
      </div>
    </DashboardContext.Provider>
  )
}

import { Suspense } from 'react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <DashboardInner>{children}</DashboardInner>
    </Suspense>
  )
}
