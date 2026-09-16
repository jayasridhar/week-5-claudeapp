export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
export const MAX_PDF_PAGES = 10
export const MAX_EXTRACTED_TEXT_CHARS = 60_000
export const DAILY_FINANCIAL_ANALYSIS_LIMIT = 5
export const DAILY_CREDIT_ANALYSIS_LIMIT = 5

export type AnalysisType = 'financial' | 'credit'

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
