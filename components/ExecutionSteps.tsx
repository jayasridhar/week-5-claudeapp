'use client'

import { Check, Circle, Loader2, X } from 'lucide-react'
import type { ExecutionStep } from '@/lib/DashboardContext'

type Props = {
  steps: ExecutionStep[]
}

export default function ExecutionSteps({ steps }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            {step.status === 'done' && (
              <span className="w-5 h-5 rounded-full bg-an-success flex items-center justify-center">
                <Check size={11} strokeWidth={2.5} className="text-white" />
              </span>
            )}
            {step.status === 'active' && (
              <Loader2 size={20} strokeWidth={1.5} className="text-an-accent animate-spin" />
            )}
            {step.status === 'error' && (
              <span className="w-5 h-5 rounded-full bg-an-error flex items-center justify-center">
                <X size={11} strokeWidth={2.5} className="text-white" />
              </span>
            )}
            {step.status === 'idle' && (
              <Circle size={20} strokeWidth={1.5} className="text-an-fg-muted" />
            )}
            {i < steps.length - 1 && (
              <div className={`absolute top-5 left-1/2 -translate-x-1/2 w-px h-3 ${
                step.status === 'done' ? 'bg-an-success' : 'bg-an-border'
              }`} />
            )}
          </div>
          <span className={`text-body-sm ${
            step.status === 'active' ? 'text-an-accent' :
            step.status === 'done'   ? 'text-an-fg-subtle' :
            step.status === 'error'  ? 'text-an-error' :
            'text-an-fg-muted'
          }`}>
            {step.label}
          </span>
        </div>
      ))}
    </div>
  )
}
