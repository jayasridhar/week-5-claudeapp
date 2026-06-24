'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, X, Send, Download, FileText, Eye, EyeOff, CreditCard, History } from 'lucide-react'

type Message = {
  role: 'user' | 'assistant'
  content: string
  id: string
}

type CreditState = {
  pdfUrl?: string
  generating?: boolean
  sending?: boolean
  showPreview?: boolean
  summary?: string
  error?: string
}

type ContentBlock =
  | { type: 'table'; rows: string[][] }
  | { type: 'text'; text: string }
  | { type: 'heading'; text: string }

function isSeparatorLine(line: string): boolean {
  return /^[\s|:\-+]+$/.test(line) && /[-]/.test(line)
}

function splitFields(line: string, delim: ',' | '|' | '\t'): string[] {
  if (delim === '|') return line.replace(/^\s*\||\|\s*$/g, '').split('|').map(c => c.trim())
  if (delim === '\t') return line.split('\t').map(c => c.trim())
  return line.split(',').map(c => c.trim())
}

function detectDelimiter(line: string): ',' | '|' | '\t' | null {
  const pipeCount = (line.match(/\|/g) ?? []).length
  if (pipeCount >= 2) return '|'
  const tabCount = (line.match(/\t/g) ?? []).length
  if (tabCount >= 1) return '\t'
  const commaCount = (line.match(/,/g) ?? []).length
  if (commaCount >= 1) return ','
  return null
}

// Numbered section titles like "1. Balance Sheet (INR Crore)" should stand
// out as headings rather than blend into surrounding paragraph text.
const HEADING_RE = /^\d+\.\s+\S/
// Markdown headings ("### Balance Sheet") and bold-only lines used as
// sub-headings ("**Balance Sheet**") also need to render as headings rather
// than literal "###"/"**" characters in a paragraph.
const MD_HEADING_RE = /^#{1,6}\s+(.+)$/
const BOLD_LINE_RE = /^\*\*(.+)\*\*$/
// Single-asterisk emphasis used as a mini-heading ("*Calculations:*"). Must
// not match double-asterisk bold lines, so the wrapped content can't itself
// start or end with "*".
const ITALIC_LINE_RE = /^\*([^*\n]+)\*$/
// Markdown horizontal rules ("---", "***") and code fences ("```", "```csv")
// are pure formatting noise once content is grouped into blocks/tables.
const HR_RE = /^(-{3,}|\*{3,})$/
const FENCE_RE = /^```/
// Excel formula error placeholder the Azure agent emits instead of formula text.
const NAME_ERROR_RE = /^#NAME\?/i
// Boilerplate the agent adds to describe table structure — redundant once
// the table itself renders.
const BOILERPLATE_RE = /^(header explanation|column order\s*[-–]|header:|label,\s*\d{4})/i

// Dollar amounts like "5,000" use a comma as a thousands separator, which
// collides with comma-delimited table detection: "2024,Equity Capital,5,000"
// splits into 4 fields instead of 3, and prose like "Net Income = 2,300 /
// 20,500" gets mistaken for a 2-row CSV table. Collapse thousands-grouped
// digits ("5,000", "1,234,567") back into one token before any parsing.
function stripThousandsSeparators(content: string): string {
  // Leading group must be 1–3 digits so "91750,100" (5-digit CSV value followed
  // by a 3-digit field) is never mistaken for a thousands-separated number.
  // Negative lookbehind on [digit/.] excludes decimal suffixes like ".00,100".
  return content.replace(/(?<![\d.])\d{1,3}(?:,\d{3})+(?!\d)/g, m => m.replace(/,/g, ''))
}

// Walks the whole response line by line and groups it into ordered text/table
// blocks, instead of grabbing only the first table-like section and dropping
// every other section (CSV blocks, prose, multiple tables) that follows it.
function parseBlocks(rawContent: string): ContentBlock[] {
  const content = stripThousandsSeparators(rawContent)
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
    if (!trimmed) {
      textBuffer.push(line)
      i++
      continue
    }

    if (HR_RE.test(trimmed) || FENCE_RE.test(trimmed) || NAME_ERROR_RE.test(trimmed) || BOILERPLATE_RE.test(trimmed)) {
      i++
      continue
    }

    // Strip outer quotes the agent uses to escape comma-containing rows
    // ("Total Assets,84500,...") so delimiter detection can parse them properly.
    const unquoted = trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1) : trimmed

    const mdHeading = unquoted.match(MD_HEADING_RE)
    const boldHeading = unquoted.match(BOLD_LINE_RE)
    const italicHeading = unquoted.match(ITALIC_LINE_RE)
    if (HEADING_RE.test(unquoted) || mdHeading || boldHeading || italicHeading) {
      flushText()
      blocks.push({ type: 'heading', text: mdHeading?.[1] ?? boldHeading?.[1] ?? italicHeading?.[1] ?? unquoted })
      i++
      continue
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
          const nextTrimmed = next.trim()
          if (NAME_ERROR_RE.test(nextTrimmed) || BOILERPLATE_RE.test(nextTrimmed)) { j++; continue }
          const nextUnquoted = nextTrimmed.startsWith('"') && nextTrimmed.endsWith('"') ? nextTrimmed.slice(1, -1) : nextTrimmed
          const nextDelim = detectDelimiter(nextUnquoted)
          if (nextDelim !== delim) break
          const nextFields = splitFields(nextUnquoted, nextDelim)
          if (nextFields.length !== fields.length) break
          rows.push(nextFields)
          j++
        }
        if (rows.length >= 2) {
          flushText()
          blocks.push({ type: 'table', rows })
          i = j
          continue
        }
      }
    }

    textBuffer.push(unquoted)
    i++
  }
  flushText()
  return pivotYearTables(mergeAdjacentTables(dropDuplicateRawSection(blocks)))
}

// The agent often emits "long" tables (one row per year+line-item, e.g.
// "Year,Account,Amount") instead of listing years as columns. Pivot any
// 3-column table whose first column is a year into a wide table with one row
// per line item and years as columns, oldest year first (left to right).
function pivotYearTables(blocks: ContentBlock[]): ContentBlock[] {
  return blocks.map(block => (block.type === 'table' ? { ...block, rows: pivotYearTable(block.rows) } : block))
}

function pivotYearTable(rows: string[][]): string[][] {
  const [header, ...body] = rows
  if (header.length !== 3 || !/^years?$/i.test(header[0].trim())) return rows
  const isYearRow = (r: string[]) => /^\d{4}$/.test(r[0]?.trim() ?? '')
  if (body.length === 0 || body.filter(isYearRow).length < body.length * 0.8) return rows

  const years = Array.from(new Set(body.filter(isYearRow).map(r => r[0].trim()))).sort((a, b) => Number(a) - Number(b))
  const items: string[] = []
  const seenItems = new Set<string>()
  for (const r of body) {
    const item = r[1]?.trim() ?? ''
    if (item && !seenItems.has(item)) {
      seenItems.add(item)
      items.push(item)
    }
  }
  const valueByItemYear = new Map<string, string>()
  for (const r of body) valueByItemYear.set(`${r[1]?.trim()}|${r[0]?.trim()}`, r[2]?.trim() ?? '')

  return [
    [header[1], ...years],
    ...items.map(item => [item, ...years.map(y => valueByItemYear.get(`${item}|${y}`) ?? '')]),
  ]
}

// The agent sometimes restates every table a second time under a trailing
// "Raw CSV Outputs" section (e.g. "Raw CSV Outputs", "Example of Raw CSV
// Output Format (Partial)") -- once the narrative tables already rendered,
// that repeat just doubles the page length with no new information.
function dropDuplicateRawSection(blocks: ContentBlock[]): ContentBlock[] {
  const cutoff = blocks.findIndex(b => b.type !== 'table' && /raw csv/i.test(b.text))
  return cutoff === -1 ? blocks : blocks.slice(0, cutoff)
}

// A short narrative aside (e.g. "Add: Depreciation 14.35") in the middle of a
// running CSV table breaks table detection early. When a table resumes right
// after a 1-2 line aside with the same column count, treat it as a
// continuation of the first table instead of misreading its first data row
// as a brand new header.
function mergeAdjacentTables(blocks: ContentBlock[]): ContentBlock[] {
  const merged: ContentBlock[] = []
  for (const block of blocks) {
    if (block.type === 'table') {
      const prev = merged[merged.length - 1]
      const prevPrev = merged[merged.length - 2]
      if (prev?.type === 'table' && prev.rows[0].length === block.rows[0].length) {
        prev.rows.push(...block.rows)
        continue
      }
      if (
        prev?.type === 'text' &&
        prev.text.split('\n').length <= 2 &&
        prevPrev?.type === 'table' &&
        prevPrev.rows[0].length === block.rows[0].length
      ) {
        prevPrev.rows.push(...block.rows)
        merged.pop()
        continue
      }
    }
    merged.push(block)
  }
  return merged
}

function tableToCSV(rows: string[][]): string {
  return rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
}

const DEFAULT_EXTRACTION_PROMPT =
  'Extract and normalize the financial data from the uploaded document. Produce normalized CSV ' +
  'outputs for the Balance Sheet, Income Statement, Statement of Retained Earnings, and Cash Flow ' +
  'Statement (estimate the Cash Flow Statement if it is not provided). Include vertical analysis, ' +
  'horizontal analysis (YoY % change), a 5-year projection, and additional metrics (DSO, DIO, DPO, CCC).'

// Dumps the entire response into one CSV, in document order: headings and
// narrative text become single-column rows, tables become multi-column rows.
function buildCombinedCSV(blocks: ContentBlock[]): string {
  const lines: string[] = []
  for (const block of blocks) {
    if (block.type === 'table') {
      lines.push(tableToCSV(block.rows))
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
              <th key={i} className="px-3 py-2 text-left text-label text-an-fg-subtle border-b border-an-border font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-an-bg-base' : 'bg-an-bg-subtle'}>
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 border-b border-an-border">{cell}</td>
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
        if (block.type === 'table') return <TableBlock key={i} rows={block.rows} />
        if (block.type === 'heading') {
          return (
            <h3 key={i} className="text-title text-an-fg-base font-medium mt-2">
              {block.text}
            </h3>
          )
        }
        return (
          <p key={i} className="text-body text-an-fg-base whitespace-pre-wrap break-words">
            {block.text}
          </p>
        )
      })}
      {blocks.length > 0 && (
        <a
          href={URL.createObjectURL(new Blob([buildCombinedCSV(blocks)], { type: 'text/csv' }))}
          download="financial_data.csv"
          className="self-start flex items-center gap-1.5 text-caption text-an-accent hover:underline"
        >
          <Download size={12} strokeWidth={1.5} />
          Download all as CSV
        </a>
      )}
    </div>
  )
}

type HistoryEntry = { id: string; file_name: string | null; created_at: string; content: string }

export default function FinancialPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState<{ name: string; text: string } | null>(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [creditState, setCreditState] = useState<Record<string, CreditState>>({})
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const userId = localStorage.getItem('userId')
    if (!userId) { router.replace('/login'); return }
    fetch(`/api/analyses?userId=${userId}&type=financial`)
      .then(r => r.json())
      .then((data: HistoryEntry[]) => Array.isArray(data) && setHistory(data))
      .catch(() => {})
  }, [router])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  async function handleFile(f: File) {
    setFileLoading(true)
    setError('')
    try {
      const name = f.name
      const lower = name.toLowerCase()
      let text = ''

      if (lower.endsWith('.csv') || lower.endsWith('.txt') || lower.endsWith('.json')) {
        text = await f.text()
      } else if (lower.endsWith('.pdf')) {
        const { GlobalWorkerOptions, getDocument } = await import('pdfjs-dist')
        GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        const buf = await f.arrayBuffer()
        const pdf = await getDocument({ data: buf }).promise
        const pages = await Promise.all(
          Array.from({ length: pdf.numPages }, (_, i) =>
            pdf.getPage(i + 1).then(p => p.getTextContent()).then(tc =>
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
      } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const XLSX = await import('xlsx')
        const buf = await f.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        text = wb.SheetNames.map(name => {
          const ws = wb.Sheets[name]
          return `Sheet: ${name}\n${XLSX.utils.sheet_to_csv(ws)}`
        }).join('\n\n')
      } else {
        setError('Unsupported file type. Use PDF, DOCX, CSV, Excel, JSON, or TXT.')
        return
      }

      setFile({ name, text })
      await sendMessage(DEFAULT_EXTRACTION_PROMPT, {
        fileOverride: { name, text },
        displayMessage: `Analyze ${name}`,
      })
    } catch {
      setError('Failed to read file. Please try again.')
    } finally {
      setFileLoading(false)
    }
  }

  async function sendMessage(
    message: string,
    opts?: { fileOverride?: { name: string; text: string }; displayMessage?: string }
  ) {
    if (!message || loading) return
    setError('')
    const activeFile = opts?.fileOverride ?? file
    const id = crypto.randomUUID()
    setMessages(prev => [...prev, { role: 'user', content: opts?.displayMessage ?? message, id }])
    setLoading(true)

    try {
      const res = await fetch('/api/financial-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileText: activeFile?.text ?? '',
          fileName: activeFile?.name ?? '',
          userMessage: message,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Request failed.')
        return
      }
      const assistantId = crypto.randomUUID()
      setMessages(prev => [...prev, { role: 'assistant', content: data.content, id: assistantId }])

      const userId = localStorage.getItem('userId')
      if (userId) {
        fetch('/api/analyses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, type: 'financial', content: data.content, fileName: activeFile?.name }),
        })
          .then(r => r.json())
          .then((saved: HistoryEntry) => saved?.id && setHistory(prev => [saved, ...prev]))
          .catch(() => {})
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSend() {
    const message = input.trim()
    if (!message) return
    setInput('')
    await sendMessage(message)
  }

  function patchCreditState(id: string, patch: Partial<CreditState>) {
    setCreditState(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  async function handleGeneratePdf(msg: Message) {
    patchCreditState(msg.id, { generating: true, error: undefined })
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
      doc.text('Financial Normalization Output', margin, y)
      y += 22

      doc.setFont('courier', 'normal')
      doc.setFontSize(9)
      const lineHeight = 12

      for (const rawLine of msg.content.split('\n')) {
        const wrapped: string[] = doc.splitTextToSize(rawLine || ' ', maxWidth)
        for (const line of wrapped) {
          if (y > pageHeight - margin) {
            doc.addPage()
            y = margin
          }
          doc.text(line, margin, y)
          y += lineHeight
        }
      }

      const blob = doc.output('blob')
      const url = URL.createObjectURL(blob)
      patchCreditState(msg.id, { pdfUrl: url, generating: false, showPreview: true })
    } catch {
      patchCreditState(msg.id, { generating: false, error: 'Failed to generate PDF.' })
    }
  }

  function handleGoToCredit(msg: Message) {
    localStorage.setItem('financial_output', msg.content)
    router.push('/dashboard/credit')
  }

  async function handleSendToCredit(msg: Message) {
    patchCreditState(msg.id, { sending: true, error: undefined })
    try {
      const res = await fetch('/api/credit-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ normalizedText: msg.content }),
      })
      const data = await res.json()
      if (!res.ok) {
        patchCreditState(msg.id, { sending: false, error: data.error ?? 'Request failed.' })
        return
      }
      patchCreditState(msg.id, { sending: false, summary: data.content })
    } catch {
      patchCreditState(msg.id, { sending: false, error: 'Something went wrong. Please try again.' })
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 h-12 border-b border-an-border flex items-center px-6 gap-3">
        <h2 className="text-body font-medium text-an-fg-base">Financial Normalization</h2>
        <span className="text-label px-2 py-0.5 rounded-full bg-an-accent-subtle text-an-accent">Beta</span>
        {history.length > 0 && (
          <button
            onClick={() => setShowHistory(v => !v)}
            className="ml-auto flex items-center gap-1.5 text-body-sm text-an-fg-subtle hover:text-an-fg-base transition-colors"
          >
            <History size={13} strokeWidth={1.5} />
            History ({history.length})
          </button>
        )}
      </div>

      {/* History panel */}
      {showHistory && history.length > 0 && (
        <div className="flex-shrink-0 border-b border-an-border bg-an-bg-subtle px-6 py-3 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <p className="text-caption text-an-fg-muted">Past analyses — click to reload</p>
            <button
              onClick={() => {
                const userId = localStorage.getItem('userId')
                if (!userId) return
                fetch(`/api/analyses?userId=${userId}&type=financial`, { method: 'DELETE' })
                  .then(() => { setHistory([]); setShowHistory(false) })
                  .catch(() => {})
              }}
              className="text-caption text-an-error hover:underline"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {history.map(h => (
              <div key={h.id} className="flex items-center gap-2 group">
                <button
                  onClick={() => {
                    setMessages([{ role: 'assistant', content: h.content, id: h.id }])
                    setShowHistory(false)
                  }}
                  className="flex flex-1 items-center gap-3 h-8 px-3 rounded text-body-sm text-an-fg-subtle hover:bg-an-bg-surface hover:text-an-fg-base transition-colors text-left min-w-0"
                >
                  <FileText size={12} strokeWidth={1.5} className="flex-shrink-0" />
                  <span className="flex-1 truncate">{h.file_name ?? 'Unnamed'}</span>
                  <span className="text-caption text-an-fg-muted flex-shrink-0">
                    {new Date(h.created_at).toLocaleDateString()}
                  </span>
                </button>
                <button
                  onClick={() => {
                    fetch(`/api/analyses?id=${h.id}`, { method: 'DELETE' })
                      .then(() => setHistory(prev => prev.filter(e => e.id !== h.id)))
                      .catch(() => {})
                  }}
                  className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 text-an-fg-muted hover:text-an-error transition-colors"
                  title="Remove"
                >
                  <X size={12} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[720px] mx-auto px-6 py-6 flex flex-col gap-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-10 h-10 rounded-full bg-an-accent-subtle flex items-center justify-center mb-4">
                <span className="w-2 h-2 rounded-full bg-an-accent" />
              </div>
              <p className="text-title text-an-fg-base mb-2">Financial Normalization Agent</p>
              <p className="text-body text-an-fg-subtle max-w-sm">
                Upload a financial document (PDF, Excel, CSV) and ask questions to normalize and analyse the data.
              </p>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'items-start gap-3'}`}>
              {msg.role === 'assistant' && (
                <span className="mt-1.5 flex-shrink-0 w-2 h-2 rounded-full bg-an-accent" />
              )}
              <div className={`${msg.role === 'user' ? 'max-w-[75%]' : 'flex-1 min-w-0'}`}>
                {msg.role === 'user' ? (
                  <div
                    className="px-4 py-3 text-body text-an-fg-base"
                    style={{
                      background: 'var(--an-accent-subtle)',
                      border: '1px solid rgba(217,119,87,0.20)',
                      borderRadius: '12px 12px 4px 12px',
                    }}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                ) : (
                  <>
                    <ResponseContent content={msg.content} />
                    <div className="mt-4 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleGeneratePdf(msg)}
                          disabled={creditState[msg.id]?.generating}
                          className="flex items-center gap-1.5 h-7 px-2.5 rounded border border-an-border text-body-sm text-an-fg-subtle hover:bg-an-bg-elevated hover:text-an-fg-base transition-colors disabled:opacity-50"
                        >
                          <FileText size={12} strokeWidth={1.5} />
                          {creditState[msg.id]?.generating
                            ? 'Generating PDF…'
                            : creditState[msg.id]?.pdfUrl
                              ? 'Regenerate PDF'
                              : 'Generate PDF'}
                        </button>
                        {creditState[msg.id]?.pdfUrl && (
                          <>
                            <a
                              href={creditState[msg.id]?.pdfUrl}
                              download="financial_normalization.pdf"
                              className="flex items-center gap-1.5 text-caption text-an-accent hover:underline"
                            >
                              <Download size={12} strokeWidth={1.5} />
                              Download PDF
                            </a>
                            <button
                              onClick={() => patchCreditState(msg.id, { showPreview: !creditState[msg.id]?.showPreview })}
                              className="flex items-center gap-1.5 text-caption text-an-fg-subtle hover:text-an-fg-base"
                            >
                              {creditState[msg.id]?.showPreview ? <EyeOff size={12} strokeWidth={1.5} /> : <Eye size={12} strokeWidth={1.5} />}
                              {creditState[msg.id]?.showPreview ? 'Hide preview' : 'Preview PDF'}
                            </button>
                          </>
                        )}
                      </div>

                      {creditState[msg.id]?.showPreview && creditState[msg.id]?.pdfUrl && (
                        <iframe
                          src={creditState[msg.id]?.pdfUrl}
                          className="w-full h-72 rounded-lg border border-an-border"
                        />
                      )}

                      <button
                        onClick={() => handleGoToCredit(msg)}
                        className="self-start flex items-center gap-1.5 h-7 px-3 rounded bg-an-accent hover:bg-an-accent-hover text-white text-label transition-colors"
                      >
                        <CreditCard size={12} strokeWidth={1.5} />
                        Run credit readiness
                      </button>

                      {creditState[msg.id]?.error && (
                        <p className="text-caption text-an-error">{creditState[msg.id]?.error}</p>
                      )}
                    </div>
                  </>
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
          {/* File chip */}
          {file && (
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center gap-1.5 h-7 px-2.5 bg-an-bg-surface border border-an-border rounded-full text-body-sm text-an-fg-subtle">
                {file.name}
                <button onClick={() => setFile(null)} className="text-an-fg-muted hover:text-an-fg-base transition-colors">
                  <X size={12} strokeWidth={2} />
                </button>
              </span>
            </div>
          )}

          <div className="rounded-xl border border-an-border p-3" style={{ background: 'var(--an-bg-surface)' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Ask about the financial data…"
              rows={1}
              disabled={loading}
              className="w-full bg-transparent border-none text-body text-an-fg-base placeholder:text-an-fg-muted resize-none focus:outline-none disabled:opacity-50 min-h-[24px] max-h-[200px] overflow-y-auto"
            />
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.csv,.xlsx,.xls,.json,.txt"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={fileLoading}
                  className="flex items-center gap-1.5 h-7 px-2.5 rounded border border-an-border text-body-sm text-an-fg-subtle hover:bg-an-bg-elevated hover:text-an-fg-base transition-colors disabled:opacity-50"
                >
                  <Upload size={12} strokeWidth={1.5} />
                  {fileLoading ? 'Reading…' : 'Upload file'}
                </button>
                <span className="text-caption text-an-fg-muted">PDF, Excel, CSV, JSON, TXT</span>
              </div>
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="w-8 h-8 rounded-full bg-an-accent hover:bg-an-accent-hover disabled:opacity-40 flex items-center justify-center transition-colors duration-150 flex-shrink-0"
              >
                <Send size={14} strokeWidth={2} className="text-white" />
              </button>
            </div>
          </div>

          {error && <p className="text-caption text-an-error text-center mt-2">{error}</p>}
        </div>
      </div>
    </div>
  )
}
