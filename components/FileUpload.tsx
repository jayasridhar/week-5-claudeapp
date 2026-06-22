'use client'

import { useRef, useState } from 'react'
import { Paperclip, X } from 'lucide-react'

type Props = {
  onFileLoaded: (text: string, filename: string, blobUrl: string, fileType: string) => void
  onClear: () => void
  filename: string | null
}

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export default function FileUpload({ onFileLoaded, onClear, filename }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [parsing, setParsing] = useState(false)

  async function handleFile(file: File) {
    setError('')

    if (!file.name.match(/\.(pdf|docx)$/i)) {
      setError('Only PDF and DOCX files are accepted.')
      return
    }
    if (file.size > MAX_SIZE) {
      setError('File must be under 10 MB.')
      return
    }

    setParsing(true)
    try {
      const fileType = file.type ||
        (file.name.endsWith('.pdf') ? 'application/pdf' :
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document')

      if (fileType === 'application/pdf' || file.name.endsWith('.pdf')) {
        const blobUrl = URL.createObjectURL(file)
        const arrayBuffer = await file.arrayBuffer()

        const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
        GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

        const pdf = await getDocument({ data: arrayBuffer }).promise
        const pages: string[] = []
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
        }
        const text = pages.join('\n\n')

        if (!text.trim()) {
          URL.revokeObjectURL(blobUrl)
          setError('No extractable text found. This may be a scanned PDF — please use a text-based PDF.')
          return
        }

        onFileLoaded(text, file.name, blobUrl, 'application/pdf')
      } else {
        const arrayBuffer = await file.arrayBuffer()
        const mammoth = await import('mammoth')
        const result = await mammoth.extractRawText({ arrayBuffer })
        const text = result.value

        if (!text.trim()) {
          setError('No extractable text found in this document.')
          return
        }

        onFileLoaded(text, file.name, '', fileType)
      }
    } catch {
      setError('Failed to parse the file. Please try another document.')
    } finally {
      setParsing(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
      />

      {filename ? (
        <div className="flex items-center gap-1.5 h-7 px-2 bg-an-accent-subtle border border-an-border rounded text-body-sm text-an-accent max-w-[160px]">
          <span className="truncate">{filename}</span>
          <button
            onClick={() => { setError(''); onClear() }}
            className="flex-shrink-0 hover:text-an-fg-base transition-colors duration-100"
          >
            <X size={12} strokeWidth={2} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={parsing}
          title="Attach PDF or DOCX"
          className="p-1.5 rounded text-an-fg-muted hover:text-an-fg-base hover:bg-an-bg-elevated transition-colors duration-100 disabled:opacity-50"
        >
          {parsing ? (
            <span className="text-caption text-an-fg-muted">Parsing…</span>
          ) : (
            <Paperclip size={16} strokeWidth={1.5} />
          )}
        </button>
      )}

      {error && (
        <p className="text-caption text-an-error">{error}</p>
      )}
    </div>
  )
}
