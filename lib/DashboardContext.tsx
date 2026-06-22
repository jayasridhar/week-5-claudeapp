'use client'

import { createContext, useContext } from 'react'
import type { SessionRow } from './db'

export type FilePreview = {
  blobUrl: string
  filename: string
  fileType: string
  extractedText: string
}

export type ExecutionStep = {
  id: string
  label: string
  status: 'idle' | 'active' | 'done' | 'error'
}

export type DashboardContextType = {
  sessions: SessionRow[]
  setSessions: (s: SessionRow[]) => void
  filePreview: FilePreview | null
  setFilePreview: (p: FilePreview | null) => void
  executionSteps: ExecutionStep[]
  setExecutionSteps: (steps: ExecutionStep[]) => void
  isProcessing: boolean
  setIsProcessing: (v: boolean) => void
  azureConnected: boolean
  setAzureConnected: (v: boolean) => void
}

export const DashboardContext = createContext<DashboardContextType | null>(null)

export function useDashboard(): DashboardContextType {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard must be used inside DashboardProvider')
  return ctx
}

export const INITIAL_STEPS: ExecutionStep[] = [
  { id: 'parse',    label: 'Parsing document',       status: 'idle' },
  { id: 'send',     label: 'Sending to Azure',        status: 'idle' },
  { id: 'wait',     label: 'Waiting for response',    status: 'idle' },
  { id: 'process',  label: 'Processing response',     status: 'idle' },
  { id: 'complete', label: 'Completed',               status: 'idle' },
]
