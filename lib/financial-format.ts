type CurrencyCode = 'CAD' | 'USD' | 'INR' | 'UNKNOWN'

const MONEY_LABEL_RE =
  /(cash|bank|sales|revenue|income|expense|cost|profit|loss|assets?|liabilit|equity|debt|loan|receivable|payable|inventory|deposit|capital|equipment|leasehold|amortization|tax|interest|wages|salary|rent|telephone|utilities|earnings|ebitda|capex|working capital|shareholder)/i
const NON_MONEY_LABEL_RE =
  /(ratio|margin|percentage|percent|%|dso|dio|dpo|ccc|days|turnover|coverage|dscr|fccr|debt\/ebitda|multiple|shares?|year|assessment|benchmark|score|rating)/i
const PERCENT_RE = /(percent|percentage|%|margin|yoy|vertical|horizontal)/i

function parseNumber(value: string) {
  const trimmed = value.trim()
  const withoutCurrencyText = trimmed.replace(/cad|ca\$|c\$|usd|us\$|inr|rs\.?/gi, '')
  if (!trimmed || /[a-z]/i.test(withoutCurrencyText)) return null

  const isNegative = /^\(.*\)$/.test(trimmed) || /^-/.test(trimmed)
  const normalized = trimmed
    .replace(/cad|ca\$|c\$|usd|us\$|inr|rs\.?/gi, '')
    .replace(/[,$₹%]/g, '')
    .replace(/[()]/g, '')
    .trim()

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null
  const valueNumber = Number(normalized)
  if (!Number.isFinite(valueNumber)) return null
  return isNegative ? -Math.abs(valueNumber) : valueNumber
}

function formatPlainNumber(value: number, original: string) {
  const decimals = (original.split('.')[1] ?? '').replace(/[^\d]/g, '').length
  return new Intl.NumberFormat('en-CA', {
    minimumFractionDigits: decimals > 0 ? Math.min(decimals, 2) : 0,
    maximumFractionDigits: decimals > 0 ? 2 : 0,
  }).format(value)
}

function formatCurrency(value: number, currency: CurrencyCode, original: string) {
  const symbol = currency === 'INR' ? '₹' : '$'
  const absolute = Math.abs(value)
  const formatted = `${symbol}${formatPlainNumber(absolute, original)}`
  return value < 0 ? `(${formatted})` : formatted
}

function formatPercent(value: number, original: string) {
  return `${formatPlainNumber(value, original.includes('.') ? original : `${original}.00`)}%`
}

export function detectCurrency(content: string): CurrencyCode {
  if (/\binr\b|\brs\.?\b|\brupees?\b|\blakhs?\b|\bcrores?\b/i.test(content)) return 'INR'
  if (/\busd\b|u\.s\. dollars?|us dollars?/i.test(content)) return 'USD'
  if (/\bcad\b|\bcdn\b|canadian dollars?|\bcanada\b|\bontario\b/i.test(content)) return 'CAD'
  return 'UNKNOWN'
}

export function formatFinancialTableCell(
  cell: string,
  rows: string[][],
  rowIndex: number,
  cellIndex: number,
  currency: CurrencyCode
) {
  if (rowIndex === 0 || cellIndex === 0) return cell

  const parsed = parseNumber(cell)
  if (parsed === null) return cell

  const header = rows[0]?.[cellIndex] ?? ''
  const label = rows[rowIndex]?.[0] ?? ''
  const context = `${header} ${label}`

  if (/^\d{4}$/.test(cell.trim())) return cell
  if (PERCENT_RE.test(context) || cell.includes('%')) return formatPercent(parsed, cell)
  if (NON_MONEY_LABEL_RE.test(context)) return formatPlainNumber(parsed, cell)
  if (/^\d{4}$/.test(header.trim()) || MONEY_LABEL_RE.test(context)) {
    return formatCurrency(parsed, currency, cell)
  }

  return formatPlainNumber(parsed, cell)
}
