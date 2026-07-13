'use client'

import { FileText } from 'lucide-react'
import ExecutionSteps from './ExecutionSteps'
import { useDashboard } from '@/lib/DashboardContext'

export default function RightPanel() {
  const { filePreview, executionSteps, isProcessing } = useDashboard()

  const hasStepActivity = executionSteps.some(s => s.status !== 'idle')

  return (
    <aside className="w-[304px] flex-shrink-0 bg-an-bg-subtle border-l border-an-border flex flex-col h-full">
      {/* Document preview — top 60% */}
      <div className="flex-[6] min-h-0 border-b border-an-border flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-an-border flex-shrink-0">
          <FileText size={14} strokeWidth={1.5} className="text-an-fg-subtle" />
          <span className="text-label text-an-fg-subtle uppercase tracking-wide">Document</span>
          {filePreview && (
            <span className="ml-auto text-caption text-an-fg-muted truncate max-w-[120px]" title={filePreview.filename}>
              {filePreview.filename}
            </span>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {!filePreview ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="w-10 h-10 rounded-full bg-an-bg-surface flex items-center justify-center">
                <FileText size={18} strokeWidth={1.5} className="text-an-fg-muted" />
              </div>
              <p className="text-body-sm text-an-fg-muted">
                Upload a document to see a preview
              </p>
            </div>
          ) : filePreview.fileType === 'application/pdf' ? (
            <iframe
              src={filePreview.blobUrl}
              className="w-full h-full border-none"
              title={filePreview.filename}
            />
          ) : (
            <pre className="font-mono text-mono text-an-fg-subtle p-4 overflow-auto h-full whitespace-pre-wrap break-words">
              {filePreview.extractedText.slice(0, 4000)}
              {filePreview.extractedText.length > 4000 && (
                '\n\n… (preview truncated at 4,000 characters)'
              )}
            </pre>
          )}
        </div>
      </div>

      {/* Execution steps — bottom 40% */}
      <div className="flex-[4] min-h-0 overflow-y-auto">
        <div className="px-4 py-3 border-b border-an-border flex-shrink-0">
          <span className="text-label text-an-fg-subtle uppercase tracking-wide">Execution steps</span>
        </div>
        <div className="p-4">
          {hasStepActivity || isProcessing ? (
            <ExecutionSteps steps={executionSteps} />
          ) : (
            <p className="text-body-sm text-an-fg-muted">
              Steps will appear here when you send a message.
            </p>
          )}
        </div>
      </div>
    </aside>
  )
}
