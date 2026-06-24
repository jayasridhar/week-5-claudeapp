'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Download, BarChart2, CreditCard, Upload, X, FileText } from 'lucide-react'
import Link from 'next/link'

type Message = {
  role: 'user' | 'assistant'
  content: string
  id: string
}

type BlockType = 'table' | 'text' | 'heading'
type ContentBlock = { type: BlockType; text: string; rows?: string[][] }

function isSeparatorLine(line: string) { return /^[\s|:\-+]+$/.test(line) && /[-]/.test(line) }
function splitFields(line: string, delim: string): string[] {
  if (delim === '|') return line.replace(/^\s*\||\|\s*$/g, '').split('|').map(c => c.trim())
  if (delim === '\t') return line.split('\t').map(c => c.trim())
  return line.split(',').map(c => c.trim())
}
function detectDelimiter(line: string): string | null {
  if ((line.match(/\|/g) ?? []).length >= 2) return '|'
  if ((line.match(/\t/g) ?? []).length >= 1) return '\t'
  if ((line.match(/,/g) ?? []).length >= 1) return ','
  return null
}
const HEADING_RE = /^\d+\.\s+\S/
const MD_HEADING_RE = /^#{1,6}\s+(.+)$/
const BOLD_LINE_RE = /^\*\*(.+)\*\*$/
const ITALIC_LINE_RE = /^\*([^*\n]+)\*$/
const HR_RE = /^(-{3,}|\*{3,})$/
const FENCE_RE = /^```/
const NAME_ERROR_RE = /^#NAME\?/i
const BOILERPLATE_RE = /^(header explanation|column order\s*[-–]|header:|label,\s*\d{4})/i

function stripThousandsSeparators(content: string): string {
  return content.replace(/(?<![\d.])\d{1,3}(?:,\d{3})+(?!\d)/g, m => m.replace(/,/g, ''))
}

// Remove LaTeX display blocks \[...\] and inline \(...\), then clean up
// leftover LaTeX commands like \text{}, \frac{}{}, \approx, etc.
function stripLatex(content: string): string {
  return content
    .replace(/\\\[[\s\S]*?\\\]/g, '')          // display math blocks
    .replace(/\\\([\s\S]*?\\\)/g, '')           // inline math
    .replace(/\\(?:text|frac|approx|times|cdot|leq|geq|Rightarrow)\b/g, '') // common commands
    .replace(/[{}]/g, '')                        // leftover braces
}

function parseBlocks(rawContent: string): ContentBlock[] {
  const content = stripThousandsSeparators(stripLatex(rawContent))
  const lines = content.split('\n')
  const blocks: ContentBlock[] = []
  let textBuffer: string[] = []
  function flushText() {
    const text = textBuffer.join('\n').trim()
    if (text) blocks.push({ type: 'text', text })
    textBuffer = []
  }
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed) { textBuffer.push(line); i++; continue }
    if (HR_RE.test(trimmed) || FENCE_RE.test(trimmed) || NAME_ERROR_RE.test(trimmed) || BOILERPLATE_RE.test(trimmed)) { i++; continue }
    const unquoted = trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1) : trimmed
    const mdHeading = unquoted.match(MD_HEADING_RE)
    const boldHeading = unquoted.match(BOLD_LINE_RE)
    const italicHeading = unquoted.match(ITALIC_LINE_RE)
    if (HEADING_RE.test(unquoted) || mdHeading || boldHeading || italicHeading) {
      flushText()
      blocks.push({ type: 'heading', text: mdHeading?.[1] ?? boldHeading?.[1] ?? italicHeading?.[1] ?? unquoted })
      i++; continue
    }
    const delim = detectDelimiter(unquoted)
    if (delim) {
      const fields = splitFields(unquoted, delim)
      if (fields.length >= 2) {
        const rows: string[][] = [fields]
        let j = i + 1
        while (j < lines.length) {
          const next = lines[j]
          if (!next.trim()) break
          if (isSeparatorLine(next)) { j++; continue }
          const nt = next.trim()
          if (NAME_ERROR_RE.test(nt) || BOILERPLATE_RE.test(nt)) { j++; continue }
          const nu = nt.startsWith('"') && nt.endsWith('"') ? nt.slice(1, -1) : nt
          const nd = detectDelimiter(nu)
          if (nd !== delim) break
          const nf = splitFields(nu, nd)
          if (nf.length !== fields.length) break
          rows.push(nf); j++
        }
        if (rows.length >= 2) { flushText(); blocks.push({ type: 'table', rows }); i = j; continue }
      }
    }
    textBuffer.push(unquoted); i++
  }
  flushText()
  return blocks
}

function tableToCSV(rows: string[][]): string {
  return rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
}

function buildCombinedCSV(blocks: ContentBlock[]): string {
  const lines: string[] = []
  for (const block of blocks) {
    if (block.type === 'table') {
      lines.push(tableToCSV(block.rows!))
    } else {
      for (const line of block.text.split('\n')) {
        if (line.trim()) lines.push(`"${line.trim().replace(/"/g, '""')}"`)
      }
    }
  }
  return lines.join('\n')
}

function TableBlock({ rows }: { rows: string[][] }) {
  const [header, ...body] = rows
  return (
    <div className="overflow-x-auto rounded-lg border border-an-border">
      <table className="w-full text-body-sm text-an-fg-base">
        <thead>
          <tr className="bg-an-bg-surface">
            {header.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left text-label text-an-fg-subtle border-b border-an-border font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-an-bg-base' : 'bg-an-bg-subtle'}>
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 border-b border-an-border whitespace-nowrap">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ResponseContent({ content }: { content: string }) {
  const blocks = parseBlocks(content)
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block, i) => {
        if (block.type === 'table') return <TableBlock key={i} rows={block.rows!} />
        if (block.type === 'heading') {
          return <h3 key={i} className="text-title text-an-fg-base font-medium mt-2">{block.text}</h3>
        }
        return (
          <p key={i} className="text-body text-an-fg-base whitespace-pre-wrap break-words">{block.text}</p>
        )
      })}
    </div>
  )
}

export default function CreditPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [normalizedText, setNormalizedText] = useState('')
  const [hasStoredData, setHasStoredData] = useState(false)
  const [fileName, setFileName] = useState('')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [fileLoading, setFileLoading] = useState(false)
  const [fileError, setFileError] = useState('')
  const [autoRan, setAutoRan] = useState(false)
  const [pdfState, setPdfState] = useState<Record<string, { url?: string; generating?: boolean }>>({})
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const userId = localStorage.getItem('userId')
    if (!userId) { router.replace('/login'); return }

    const stored = localStorage.getItem('financial_output')
    if (stored) {
      setNormalizedText(stored)
      setHasStoredData(true)
    }
  }, [router])

  useEffect(() => {
    if (hasStoredData && normalizedText && !autoRan && messages.length === 0) {
      setAutoRan(true)
      runAssessment(normalizedText, undefined)
    }
  }, [hasStoredData, normalizedText, autoRan, messages.length])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleFile(f: File) {
    setFileLoading(true)
    setFileError('')
    try {
      const name = f.name
      const lower = name.toLowerCase()
      let text = ''

      if (lower.endsWith('.pdf')) {
        const { GlobalWorkerOptions, getDocument } = await import('pdfjs-dist')
        GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        const buf = await f.arrayBuffer()
        const pdf = await getDocument({ data: buf }).promise
        const pages = await Promise.all(
          Array.from({ length: pdf.numPages }, (_, idx) =>
            pdf.getPage(idx + 1).then(p => p.getTextContent()).then(tc =>
              tc.items.map((it: any) => it.str).join(' ')
            )
          )
        )
        text = pages.join('\n')
      } else if (lower.endsWith('.docx')) {
        const mammoth = await import('mammoth')
        const buf = await f.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer: buf })
        text = result.value
      } else if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
        text = await f.text()
      } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const XLSX = await import('xlsx')
        const buf = await f.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        text = wb.SheetNames.map(sname => {
          const ws = wb.Sheets[sname]
          return `Sheet: ${sname}\n${XLSX.utils.sheet_to_csv(ws)}`
        }).join('\n\n')
      } else {
        setFileError('Unsupported file type. Use PDF, DOCX, CSV, Excel, or TXT.')
        return
      }

      setFileName(name)
      setNormalizedText(text)
      setHasStoredData(true)
      setAutoRan(true)
      setMessages([])
      runAssessment(text, undefined)
    } catch {
      setFileError('Failed to read file. Please try again.')
    } finally {
      setFileLoading(false)
    }
  }

  async function runAssessment(text: string, userMessage: string | undefined) {
    const userMsg = userMessage ?? 'Provide a full credit readiness assessment.'
    const userEntry: Message = { role: 'user', content: userMsg, id: Date.now().toString() }
    setMessages(prev => [...prev, userEntry])
    setLoading(true)

    try {
      const res = await fetch('/api/credit-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ normalizedText: text, userMessage }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Request failed.')
      const assistantEntry: Message = { role: 'assistant', content: data.content, id: (Date.now() + 1).toString() }
      setMessages(prev => [...prev, assistantEntry])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${msg}`, id: (Date.now() + 1).toString() }])
    } finally {
      setLoading(false)
    }
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || loading || !normalizedText) return
    setInput('')
    await runAssessment(normalizedText, text)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  async function handleGeneratePdf(msg: Message) {
    setPdfState(prev => ({ ...prev, [msg.id]: { ...prev[msg.id], generating: true } }))
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'pt', format: 'letter' })
      const margin = 40
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const maxWidth = pageWidth - margin * 2
      let y = margin

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text('Credit Readiness Assessment', margin, y)
      y += 24

      const blocks = parseBlocks(msg.content)
      for (const block of blocks) {
        if (block.type === 'heading') {
          if (y > pageHeight - margin - 20) { doc.addPage(); y = margin }
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(11)
          y += 8
          doc.text(block.text, margin, y)
          y += 16
        } else if (block.type === 'table') {
          const rows = block.rows!
          const colCount = rows[0].length
          const colWidth = Math.min(maxWidth / colCount, 140)
          for (let r = 0; r < rows.length; r++) {
            if (y > pageHeight - margin - 14) { doc.addPage(); y = margin }
            if (r === 0) {
              doc.setFont('helvetica', 'bold')
              doc.setFontSize(8)
              doc.setFillColor(50, 50, 50)
              doc.rect(margin, y - 10, maxWidth, 14, 'F')
              doc.setTextColor(255, 255, 255)
            } else {
              doc.setFont('helvetica', 'normal')
              doc.setFontSize(8)
              doc.setTextColor(0, 0, 0)
              if (r % 2 === 0) {
                doc.setFillColor(245, 245, 243)
                doc.rect(margin, y - 10, maxWidth, 14, 'F')
              }
            }
            rows[r].forEach((cell, ci) => {
              const x = margin + ci * colWidth
              const clipped = doc.splitTextToSize(cell, colWidth - 4)[0] ?? ''
              doc.text(clipped, x + 2, y)
            })
            y += 14
          }
          doc.setTextColor(0, 0, 0)
          y += 6
        } else {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(9)
          doc.setTextColor(0, 0, 0)
          for (const line of block.text.split('\n')) {
            const wrapped = doc.splitTextToSize(line || ' ', maxWidth)
            for (const wl of wrapped) {
              if (y > pageHeight - margin) { doc.addPage(); y = margin }
              doc.text(wl, margin, y)
              y += 13
            }
          }
          y += 4
        }
      }

      const blob = doc.output('blob')
      const url = URL.createObjectURL(blob)
      setPdfState(prev => ({ ...prev, [msg.id]: { url, generating: false } }))
    } catch {
      setPdfState(prev => ({ ...prev, [msg.id]: { generating: false } }))
    }
  }

  function handleClearFile() {
    setFileName('')
    setNormalizedText('')
    setHasStoredData(false)
    setAutoRan(false)
    setMessages([])
    setFileError('')
    localStorage.removeItem('financial_output')
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-an-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <CreditCard size={16} strokeWidth={1.5} className="text-an-accent" />
          <h1 className="text-title text-an-fg-base">Credit Readiness</h1>
        </div>
        <Link
          href="/dashboard/financial"
          className="flex items-center gap-1.5 text-body-sm text-an-fg-subtle hover:text-an-fg-base transition-colors"
        >
          <BarChart2 size={13} strokeWidth={1.5} />
          Back to Financial Analysis
        </Link>
      </div>

      {/* Upload state */}
      {!hasStoredData && (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <CreditCard size={32} strokeWidth={1} className="text-an-fg-muted mx-auto mb-3" />
              <h2 className="text-title text-an-fg-base mb-2">Upload financial data</h2>
              <p className="text-body-sm text-an-fg-subtle">
                Upload a financial statement, or run{' '}
                <Link href="/dashboard/financial" className="text-an-accent hover:underline">
                  Financial Analysis
                </Link>{' '}
                first to auto-populate.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.csv,.xlsx,.xls,.txt"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={fileLoading}
              className="w-full h-32 rounded-xl border-2 border-dashed border-an-border hover:border-an-border-strong hover:bg-an-bg-surface transition-colors flex flex-col items-center justify-center gap-2 disabled:opacity-50"
            >
              <Upload size={20} strokeWidth={1.5} className="text-an-fg-muted" />
              <span className="text-body-sm text-an-fg-subtle">
                {fileLoading ? 'Reading file…' : 'Click to upload'}
              </span>
              <span className="text-caption text-an-fg-muted">PDF, DOCX, CSV, Excel, TXT</span>
            </button>

            {fileError && (
              <p className="mt-3 text-caption text-an-error text-center">{fileError}</p>
            )}
          </div>
        </div>
      )}

      {/* Chat area */}
      {hasStoredData && (
        <>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="max-w-[720px] mx-auto flex flex-col gap-6">

              {/* File chip */}
              {fileName && (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 h-7 px-2.5 bg-an-bg-surface border border-an-border rounded-full text-body-sm text-an-fg-subtle">
                    {fileName}
                    <button onClick={handleClearFile} className="text-an-fg-muted hover:text-an-fg-base transition-colors">
                      <X size={12} strokeWidth={2} />
                    </button>
                  </span>
                </div>
              )}

              {messages.map(msg => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <span className="flex-shrink-0 w-2 h-2 rounded-full bg-an-accent mt-2" />
                  )}
                  <div className={msg.role === 'user'
                    ? 'max-w-[75%] bg-an-accent-subtle border border-[rgba(217,119,87,0.20)] rounded-[12px_12px_4px_12px] px-4 py-3 text-body text-an-fg-base'
                    : 'flex-1 min-w-0'
                  }>
                    {msg.role === 'assistant' ? (
                      <div className="flex flex-col gap-3">
                        <ResponseContent content={msg.content} />
                        <div className="flex items-center gap-3 pt-1 flex-wrap">
                          <a
                            href={URL.createObjectURL(new Blob([buildCombinedCSV(parseBlocks(msg.content))], { type: 'text/csv' }))}
                            download="credit_readiness.csv"
                            className="flex items-center gap-1.5 text-caption text-an-accent hover:underline"
                          >
                            <Download size={12} strokeWidth={1.5} />
                            Download CSV
                          </a>
                          {pdfState[msg.id]?.url ? (
                            <a
                              href={pdfState[msg.id]!.url}
                              download="credit_readiness.pdf"
                              className="flex items-center gap-1.5 text-caption text-an-accent hover:underline"
                            >
                              <Download size={12} strokeWidth={1.5} />
                              Download PDF
                            </a>
                          ) : (
                            <button
                              onClick={() => handleGeneratePdf(msg)}
                              disabled={pdfState[msg.id]?.generating}
                              className="flex items-center gap-1.5 text-caption text-an-fg-subtle hover:text-an-fg-base transition-colors disabled:opacity-50"
                            >
                              <FileText size={12} strokeWidth={1.5} />
                              {pdfState[msg.id]?.generating ? 'Generating PDF…' : 'Generate PDF'}
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-body">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-2 h-2 rounded-full bg-an-accent" />
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-an-fg-muted animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-an-fg-muted animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-an-fg-muted animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Composer */}
          <div className="px-6 pb-6 flex-shrink-0">
            <div className="max-w-[720px] mx-auto">
              <div className="bg-an-bg-surface border border-an-border rounded-xl px-4 py-3 flex items-end gap-3">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a follow-up question…"
                  rows={1}
                  className="flex-1 bg-transparent border-none outline-none resize-none text-body text-an-fg-base placeholder:text-an-fg-muted max-h-[200px] overflow-y-auto"
                  style={{ lineHeight: '1.6' }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className="flex-shrink-0 w-8 h-8 rounded-full bg-an-accent hover:bg-an-accent-hover disabled:opacity-40 flex items-center justify-center transition-colors"
                >
                  <Send size={14} strokeWidth={2} className="text-white" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
