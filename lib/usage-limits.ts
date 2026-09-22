export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
export const MAX_PDF_PAGES = 10
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
