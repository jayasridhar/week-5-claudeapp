export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
export const MAX_PDF_PAGES = readPositiveInt(
  process.env.NEXT_PUBLIC_MAX_PDF_PAGES ?? process.env.MAX_PDF_PAGES,
  30
)
export const MAX_EXTRACTED_TEXT_CHARS = 60_000
const DEFAULT_DAILY_ANALYSIS_LIMIT = process.env.NODE_ENV === 'production' ? 5 : 50
export const DAILY_FINANCIAL_ANALYSIS_LIMIT = readPositiveInt(
  process.env.DAILY_FINANCIAL_ANALYSIS_LIMIT,
  DEFAULT_DAILY_ANALYSIS_LIMIT
)
export const DAILY_CREDIT_ANALYSIS_LIMIT = readPositiveInt(
  process.env.DAILY_CREDIT_ANALYSIS_LIMIT,
  DEFAULT_DAILY_ANALYSIS_LIMIT
)

export type AnalysisType = 'financial' | 'credit'

function readPositiveInt(raw: string | undefined, fallback: number) {
  const parsed = Number.parseInt(raw ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function validatePdfPageRange(raw: string, totalPages?: number) {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { normalized: '', pageCount: 0, error: '' }
  }

  const compact = trimmed.replace(/\s+/g, '')
  if (!/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/.test(compact)) {
    return {
      normalized: '',
      pageCount: 0,
      error: 'Use a page range like 1-8 or 1-3,7,10-12.',
    }
  }

  const selectedPages = new Set<number>()
  const normalizedParts: string[] = []

  for (const part of compact.split(',')) {
    const [startRaw, endRaw] = part.split('-')
    const start = Number.parseInt(startRaw, 10)
    const end = endRaw ? Number.parseInt(endRaw, 10) : start

    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < 1) {
      return { normalized: '', pageCount: 0, error: 'Page numbers must be positive whole numbers.' }
    }
    if (end < start) {
      return { normalized: '', pageCount: 0, error: `Page range ${part} ends before it starts.` }
    }
    if (totalPages && end > totalPages) {
      return { normalized: '', pageCount: 0, error: `Page range ${part} exceeds this PDF's ${totalPages} pages.` }
    }

    normalizedParts.push(start === end ? String(start) : `${start}-${end}`)
    for (let page = start; page <= end; page++) selectedPages.add(page)
  }

  if (selectedPages.size > MAX_PDF_PAGES) {
    return {
      normalized: '',
      pageCount: selectedPages.size,
      error: `Selected range has ${selectedPages.size} pages. Select up to ${MAX_PDF_PAGES} pages.`,
    }
  }

  return { normalized: normalizedParts.join(','), pageCount: selectedPages.size, error: '' }
}

export function getDailyAnalysisLimit(type: AnalysisType) {
  return type === 'financial' ? DAILY_FINANCIAL_ANALYSIS_LIMIT : DAILY_CREDIT_ANALYSIS_LIMIT
}

export function formatBytes(bytes: number) {
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`
}

export function getTodayStartIso() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today.toISOString()
}

export function getDailyLimitMessage(type: AnalysisType) {
  return `Daily ${type} analysis limit reached. Try again tomorrow or raise the app limit after reviewing Azure costs.`
}
