'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, X, Send, Download, FileText, History } from 'lucide-react'
import { formatBytes, MAX_PDF_PAGES, MAX_UPLOAD_BYTES, validatePdfPageRange } from '@/lib/usage-limits'

type Message = {
  role: 'user' | 'assistant'
  content: string
  id: string
}

type ExtractionMeta = {
  pageCount?: number
  totalPageCount?: number
  pageRange?: string
  tableCount?: number
  warning?: string
}

type UploadedFile = {
  name: string
  text: string
  meta?: ExtractionMeta
}

type ContentBlock =
  | { type: 'table'; rows: string[][] }
  | { type: 'text'; text: string }
  | { type: 'heading'; text: string }

type WorkbookCell = string | number | { t?: string; v?: string | number; f?: string; z?: string }

const WHOLE_NUMBER_FORMAT = '#,##0;-#,##0;0'

function isSeparatorLine(line: string): boolean {
  return /^[\s|:\-+]+$/.test(line) && /[-]/.test(line)
}

function splitFields(line: string, delim: ',' | '|' | '\t'): string[] {
  if (delim === '|') return line.replace(/^\s*\||\|\s*$/g, '').split('|').map(c => c.trim())
  if (delim === '\t') return line.split('\t').map(c => c.trim())
  const fields: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const next = line[i + 1]
    if (char === '"' && quoted && next === '"') {
      field += '"'
      i++
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      fields.push(field.trim())
      field = ''
    } else {
      field += char
    }
  }
  fields.push(field.trim())
  return fields
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

// Numbered section titles like "1. Balance Sheet (CAD 000s)" should stand
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
  const content = rawContent
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

function excelColumn(index: number) {
  let col = ''
  let n = index + 1
  while (n > 0) {
    const rem = (n - 1) % 26
    col = String.fromCharCode(65 + rem) + col
    n = Math.floor((n - 1) / 26)
  }
  return col
}

function excelRef(rowIndex: number, colIndex: number) {
  return `${excelColumn(colIndex)}${rowIndex + 1}`
}

function normalizeAccount(label: string) {
  return label.trim().toLowerCase()
}

function parseFinancialNumber(raw: string) {
  const trimmed = raw.trim()
  if (!trimmed || trimmed === '-') return null
  const negative = trimmed.startsWith('-') || /^\(.*\)$/.test(trimmed)
  const cleaned = trimmed
    .replace(/[,$₹%]/g, '')
    .replace(/[()]/g, '')
    .trim()
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null
  const value = Number(cleaned)
  if (!Number.isFinite(value)) return null
  return negative ? -Math.abs(value) : value
}

function workbookValue(cell: string, header: string): WorkbookCell {
  const parsed = parseFinancialNumber(cell)
  if (parsed === null || /^\d{4}$/.test(cell.trim())) return cell
  if (header.includes('%') || cell.includes('%')) {
    return { t: 'n', v: parsed / 100, z: '0.0%' }
  }
  return { t: 'n', v: parsed, z: WHOLE_NUMBER_FORMAT }
}

function getCellNumber(row: WorkbookCell[] | undefined, colIndex: number) {
  const cell = row?.[colIndex]
  if (typeof cell === 'number') return cell
  if (typeof cell === 'object' && typeof cell.v === 'number') return cell.v
  if (typeof cell === 'string') return parseFinancialNumber(cell)
  return null
}

function formulaCell(formula: string, value: number | null, isPercent = false): WorkbookCell {
  return {
    t: 'n',
    f: formula,
    v: value ?? 0,
    z: isPercent ? '0.0%' : WHOLE_NUMBER_FORMAT,
  }
}

const FORMULA_TEXT: Record<string, string> = {
  'gross revenue': 'Cost of Sales + Gross Margin when Gross Revenue is not provided',
  'cost of sales': 'Materials + Labour + Variable Costs + Fixed Costs when Cost of Sales is not provided',
  'gross margin': 'Gross Revenue - Cost of Sales',
  'operating costs': 'Logistics + SG&A + Depreciation + Interest when Operating Costs is not provided',
  'operating income': 'Gross Margin - Operating Costs',
  'net income': 'Operating Income - Corporate Tax when Net Income is not provided; otherwise extracted from source',
  ebitda: 'Net Income + Interest + Depreciation + Corporate Tax',
  'total assets': 'Cash + Accounts receivable + Inventory + Prepaids and deposits + Property and equipment + Due from related parties + Other assets when Total Assets is not provided',
  'total liabilities': 'Bank indebtedness + Accounts payable + Income taxes payable + Short-term loans + Due to related parties + CEBA loan + Long-term loans when Total Liabilities is not provided',
  'shareholder equity': 'Common Shares + Retained Earnings when Shareholder Equity is not provided',
  'tl + se': 'Total Liabilities + Shareholder Equity',
  'cash provided by (used in) operating activities': 'Net income + Depreciation + Working capital changes',
  'cash used in investing activities': 'Acquisition of property and equipment',
  'cash used for financing activities': 'Bank loan activity + Related party activity + Dividends + Shareholder loan activity',
  'increase (decrease) in cash': 'Operating cash flow + Investing cash flow + Financing cash flow',
  'cash - beginning of year': 'Prior year computed Cash - End of year; earliest year starts at zero',
  'cash - end of year': 'Cash - Beginning of year + Increase decrease in cash',
}

function setFormulaIfRowsExist(
  aoa: WorkbookCell[][],
  rowMap: Map<string, number>,
  targetLabel: string,
  colIndex: number,
  refs: string[],
  formula: (rows: number[]) => string
) {
  const targetRow = rowMap.get(normalizeAccount(targetLabel))
  const refRows = refs.map(ref => rowMap.get(normalizeAccount(ref)))
  if (targetRow === undefined || refRows.some(row => row === undefined)) return
  const existing = getCellNumber(aoa[targetRow], colIndex)
  aoa[targetRow][colIndex] = formulaCell(formula(refRows as number[]), existing)
}

function applyStatementFormulas(
  aoa: WorkbookCell[][],
  rowMap: Map<string, number>,
  amountCols: number[],
  percentCols: number[],
  horizontalCol?: number
) {
  amountCols.forEach(col => {
    setFormulaIfRowsExist(aoa, rowMap, 'Cost of Sales', col, ['Materials', 'Labour', 'Variable Costs', 'Fixed Costs'], rows =>
      rows.map(row => excelRef(row, col)).join('+')
    )
    setFormulaIfRowsExist(aoa, rowMap, 'Gross Margin', col, ['Gross Revenue', 'Cost of Sales'], ([revenue, cost]) =>
      `${excelRef(revenue, col)}-${excelRef(cost, col)}`
    )
    setFormulaIfRowsExist(aoa, rowMap, 'Operating Costs', col, ['Logistics', 'SG&A', 'Depreciation', 'Interest'], rows =>
      rows.map(row => excelRef(row, col)).join('+')
    )
    setFormulaIfRowsExist(aoa, rowMap, 'Operating Income', col, ['Gross Margin', 'Operating Costs'], ([margin, costs]) =>
      `${excelRef(margin, col)}-${excelRef(costs, col)}`
    )
    setFormulaIfRowsExist(aoa, rowMap, 'EBITDA', col, ['Net Income', 'Interest', 'Depreciation', 'Corporate Tax'], rows =>
      rows.map(row => excelRef(row, col)).join('+')
    )
  })

  const revenueRow = rowMap.get('gross revenue')
  if (revenueRow !== undefined) {
    percentCols.forEach((col, index) => {
      const amountCol = amountCols[index]
      if (amountCol === undefined) return
      rowMap.forEach(row => {
        const existing = getCellNumber(aoa[row], col)
        if (existing === null) return
        aoa[row][col] = formulaCell(`${excelRef(row, amountCol)}/${excelRef(revenueRow, amountCol)}`, existing, true)
      })
    })
  }

  if (horizontalCol !== undefined && amountCols.length >= 2) {
    rowMap.forEach(row => {
      const existing = getCellNumber(aoa[row], horizontalCol)
      if (existing === null) return
      aoa[row][horizontalCol] = formulaCell(`${excelRef(row, amountCols[0])}/${excelRef(row, amountCols[1])}-1`, existing, true)
    })
  }
}

function applyBalanceFormulas(
  aoa: WorkbookCell[][],
  rowMap: Map<string, number>,
  amountCols: number[],
  percentCols: number[],
  horizontalCol?: number
) {
  const assetLabels = ['Cash', 'Accounts receivable (net)', 'Inventory', 'Prepaid Expenses & Deposits', 'Property & Equipment', 'Due from Related Parties', 'Other Assets']
  const liabilityLabels = ['Bank Indebtedness', 'Accounts Payable & Accrued Liabilities', 'Income taxes payable', 'Short-term Loans', 'Due to related parties', 'CEBA Loan payable', 'Long-term Loans']

  amountCols.forEach(col => {
    setFormulaIfRowsExist(aoa, rowMap, 'Total Assets', col, assetLabels, rows => rows.map(row => excelRef(row, col)).join('+'))
    setFormulaIfRowsExist(aoa, rowMap, 'Total Liabilities', col, liabilityLabels, rows => rows.map(row => excelRef(row, col)).join('+'))
    setFormulaIfRowsExist(aoa, rowMap, 'Shareholder Equity', col, ['Common Shares', 'Retained Earnings'], rows => rows.map(row => excelRef(row, col)).join('+'))
    setFormulaIfRowsExist(aoa, rowMap, 'TL + SE', col, ['Total Liabilities', 'Shareholder Equity'], rows => rows.map(row => excelRef(row, col)).join('+'))
  })

  percentCols.forEach((col, index) => {
    const amountCol = amountCols[index]
    if (amountCol === undefined) return
    rowMap.forEach((row, label) => {
      const existing = getCellNumber(aoa[row], col)
      if (existing === null) return
      let baseLabel = 'total assets'
      if (['bank indebtedness', 'accounts payable & accrued liabilities', 'income taxes payable', 'short-term loans', 'due to related parties', 'ceba loan payable', 'long-term loans'].includes(label)) {
        baseLabel = 'total liabilities'
      } else if (['common shares', 'retained earnings'].includes(label)) {
        baseLabel = 'shareholder equity'
      }
      const baseRow = rowMap.get(baseLabel)
      if (baseRow !== undefined) aoa[row][col] = formulaCell(`${excelRef(row, amountCol)}/${excelRef(baseRow, amountCol)}`, existing, true)
    })
  })

  if (horizontalCol !== undefined && amountCols.length >= 2) {
    rowMap.forEach(row => {
      const existing = getCellNumber(aoa[row], horizontalCol)
      if (existing === null) return
      aoa[row][horizontalCol] = formulaCell(`${excelRef(row, amountCols[0])}/${excelRef(row, amountCols[1])}-1`, existing, true)
    })
  }
}

function applyCashFlowFormulas(
  aoa: WorkbookCell[][],
  cashMap: Map<string, number>,
  incomeMap: Map<string, number> | undefined,
  balanceMap: Map<string, number> | undefined,
  amountCols: number[]
) {
  const setDirect = (target: string, sourceMap: Map<string, number> | undefined, source: string, col: number) => {
    const targetRow = cashMap.get(normalizeAccount(target))
    const sourceRow = sourceMap?.get(normalizeAccount(source))
    if (targetRow === undefined || sourceRow === undefined) return
    const existing = getCellNumber(aoa[targetRow], col)
    aoa[targetRow][col] = formulaCell(excelRef(sourceRow, col), existing)
  }

  amountCols.forEach((col, index) => {
    const priorCol = amountCols[index + 1]
    setDirect('Net income', incomeMap, 'Net Income', col)
    setDirect('Depreciation and amortization', incomeMap, 'Depreciation', col)

    const balanceFormula = (label: string, reverse: boolean) => {
      const targetRow = cashMap.get(normalizeAccount(label))
      const sourceLabel = label === 'Accounts receivable'
        ? 'Accounts receivable (net)'
        : label === 'Inventories'
          ? 'Inventory'
          : label === 'Prepaid and deposits'
            ? 'Prepaid Expenses & Deposits'
            : label === 'Accounts payable and accrued liabilities'
              ? 'Accounts Payable & Accrued Liabilities'
              : label
      const sourceRow = balanceMap?.get(normalizeAccount(sourceLabel))
      if (targetRow === undefined || sourceRow === undefined) return
      const existing = getCellNumber(aoa[targetRow], col)
      if (priorCol !== undefined) {
        aoa[targetRow][col] = formulaCell(
          reverse
            ? `${excelRef(sourceRow, priorCol)}-${excelRef(sourceRow, col)}`
            : `${excelRef(sourceRow, col)}-${excelRef(sourceRow, priorCol)}`,
          existing
        )
      } else {
        aoa[targetRow][col] = formulaCell(reverse ? `-${excelRef(sourceRow, col)}` : excelRef(sourceRow, col), existing)
      }
    }

    balanceFormula('Accounts receivable', true)
    balanceFormula('Inventories', true)
    balanceFormula('Prepaid and deposits', true)
    balanceFormula('Accounts payable and accrued liabilities', false)
    balanceFormula('Income taxes payable', false)
    balanceFormula('Advances to related corporations', false)

    const acquisitionRow = cashMap.get('acquisition of property and equipment')
    const ppeRow = balanceMap?.get('property & equipment')
    if (acquisitionRow !== undefined && ppeRow !== undefined) {
      const existing = getCellNumber(aoa[acquisitionRow], col)
      aoa[acquisitionRow][col] = formulaCell(
        priorCol !== undefined ? `${excelRef(ppeRow, priorCol)}-${excelRef(ppeRow, col)}` : `-${excelRef(ppeRow, col)}`,
        existing
      )
    }

    setFormulaIfRowsExist(
      aoa,
      cashMap,
      'Cash provided by (used in) operating activities',
      col,
      ['Net income', 'Depreciation and amortization', 'Accounts receivable', 'Inventories', 'Prepaid and deposits', 'Accounts payable and accrued liabilities', 'Income taxes payable'],
      rows => rows.map(row => excelRef(row, col)).join('+')
    )
    setFormulaIfRowsExist(aoa, cashMap, 'Cash used in investing activities', col, ['Acquisition of property and equipment'], ([row]) => excelRef(row, col))

    const proceedsRow = cashMap.get('proceeds from (repayment of) bank loan')
    const cashBeginningRow = cashMap.get('cash - beginning of year')
    const operatingRow = cashMap.get('cash provided by (used in) operating activities')
    const investingRow = cashMap.get('cash used in investing activities')
    const advancesRow = cashMap.get('advances to related corporations')
    const balanceCashRow = balanceMap?.get('cash')
    if (
      proceedsRow !== undefined &&
      cashBeginningRow !== undefined &&
      operatingRow !== undefined &&
      investingRow !== undefined &&
      advancesRow !== undefined
    ) {
      const existing = getCellNumber(aoa[proceedsRow], col)
      const targetCashChange = balanceCashRow !== undefined && priorCol !== undefined
        ? `${excelRef(balanceCashRow, col)}-${excelRef(cashBeginningRow, col)}`
        : `0-${excelRef(cashBeginningRow, col)}`
      aoa[proceedsRow][col] = formulaCell(
        `${targetCashChange}-${excelRef(operatingRow, col)}-${excelRef(investingRow, col)}-${excelRef(advancesRow, col)}`,
        existing
      )
    }

    setFormulaIfRowsExist(
      aoa,
      cashMap,
      'Cash used for financing activities',
      col,
      ['Proceeds from (repayment of) bank loan', 'Advances to related corporations'],
      rows => rows.map(row => excelRef(row, col)).join('+')
    )
    setFormulaIfRowsExist(
      aoa,
      cashMap,
      'Increase (decrease) in cash',
      col,
      ['Cash provided by (used in) operating activities', 'Cash used in investing activities', 'Cash used for financing activities'],
      rows => rows.map(row => excelRef(row, col)).join('+')
    )

    const beginningRow = cashMap.get('cash - beginning of year')
    const endRow = cashMap.get('cash - end of year')
    const increaseRow = cashMap.get('increase (decrease) in cash')
    if (beginningRow !== undefined && endRow !== undefined) {
      const existing = getCellNumber(aoa[beginningRow], col)
      aoa[beginningRow][col] = formulaCell(priorCol !== undefined ? excelRef(endRow, priorCol) : '0', existing)
    }
    if (endRow !== undefined && beginningRow !== undefined && increaseRow !== undefined) {
      const existing = getCellNumber(aoa[endRow], col)
      aoa[endRow][col] = formulaCell(`${excelRef(beginningRow, col)}+${excelRef(increaseRow, col)}`, existing)
    }
  })
}

const DEFAULT_EXTRACTION_PROMPT =
  'Normalize the uploaded historical financial statements. Generate cash flow from the extracted balance sheet and income statement, and include vertical analysis, horizontal analysis, and EBITDA.'

// Dumps the entire response into one CSV, in document order: headings and
// narrative text become single-column rows, tables become multi-column rows.
function buildCombinedCSV(blocks: ContentBlock[]): string {
  const lines: string[] = []
  blocks.forEach((block, index) => {
    if (block.type === 'table') {
      lines.push(tableToCSV(block.rows))
    } else {
      for (const line of block.text.split('\n')) {
        if (line.trim()) lines.push(`"${line.trim().replace(/"/g, '""')}"`)
      }
    }
    if (index < blocks.length - 1) lines.push('', '')
  })
  return lines.join('\n')
}

async function downloadExcel(content: string) {
  const XLSX = await import('xlsx')
  const blocks = parseBlocks(content)
  const aoa: WorkbookCell[][] = []
  const sectionMaps = new Map<string, Map<string, number>>()
  const sectionAmountCols = new Map<string, number[]>()
  const sectionPercentCols = new Map<string, number[]>()
  const sectionHorizontalCol = new Map<string, number | undefined>()
  let currentHeading = ''

  function pushBlankRows(count = 1) {
    for (let i = 0; i < count; i++) aoa.push([])
  }

  for (const block of blocks) {
    if (block.type === 'heading') {
      currentHeading = block.text
      aoa.push([currentHeading])
      continue
    }

    if (block.type === 'text') {
      for (const line of block.text.split('\n')) {
        if (line.trim()) aoa.push([line.trim()])
      }
      continue
    }

    const isFinancialTable = [
      'Income Statement',
      'Balance Sheet',
      'Cash Flow Statement (Computed from Balance Sheet and Income Statement)',
      'EBITDA',
    ].includes(currentHeading)
    const header = block.rows[0] ?? []
    const amountCols = header
      .map((cell, index) => (/^\d{4}$/.test(cell.trim()) ? index : -1))
      .filter(index => index >= 0)
    const percentCols = header
      .map((cell, index) => (cell.includes('Vertical') ? index : -1))
      .filter(index => index >= 0)
    const horizontalCol = header.findIndex(cell => cell.includes('Horizontal'))
    const rowMap = new Map<string, number>()

    block.rows.forEach((row, rowIndex) => {
      const workbookRow: WorkbookCell[] = row.map((cell, colIndex) => {
        const headerCell = header[colIndex] ?? ''
        return rowIndex >= 3 || (!isFinancialTable && rowIndex > 0)
          ? workbookValue(cell, headerCell)
          : cell
      })

      if (isFinancialTable && rowIndex >= 3) {
        const label = row[0] ?? ''
        if (label) {
          rowMap.set(normalizeAccount(label), aoa.length)
        }
      }

      if (isFinancialTable && rowIndex === 0) workbookRow.push('Formula / Source')
      if (isFinancialTable && rowIndex === 1) workbookRow.push('')
      if (isFinancialTable && rowIndex === 2) workbookRow.push('')
      if (isFinancialTable && rowIndex >= 3) {
        const label = row[0] ?? ''
        if (label) workbookRow.push(FORMULA_TEXT[normalizeAccount(label)] ?? 'Extracted from source statement')
      }

      aoa.push(workbookRow)
    })

    if (isFinancialTable) {
      sectionMaps.set(currentHeading, rowMap)
      sectionAmountCols.set(currentHeading, amountCols)
      sectionPercentCols.set(currentHeading, percentCols)
      sectionHorizontalCol.set(currentHeading, horizontalCol >= 0 ? horizontalCol : undefined)
    }
    pushBlankRows(2)
  }

  const incomeMap = sectionMaps.get('Income Statement')
  if (incomeMap) {
    applyStatementFormulas(
      aoa,
      incomeMap,
      sectionAmountCols.get('Income Statement') ?? [],
      sectionPercentCols.get('Income Statement') ?? [],
      sectionHorizontalCol.get('Income Statement')
    )
  }

  const balanceMap = sectionMaps.get('Balance Sheet')
  if (balanceMap) {
    applyBalanceFormulas(
      aoa,
      balanceMap,
      sectionAmountCols.get('Balance Sheet') ?? [],
      sectionPercentCols.get('Balance Sheet') ?? [],
      sectionHorizontalCol.get('Balance Sheet')
    )
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [
    { wch: 42 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 22 },
    { wch: 72 },
  ]
  ws['!freeze'] = { xSplit: 1, ySplit: 0 }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Financial Output')
  XLSX.writeFile(wb, 'financial_data.xlsx', { compression: true })
}

type ExtractionDiagnostics = {
  endpointHost?: string
  endpointPath?: string
  keyLength?: number
  endpointLooksLikeCognitiveServices?: boolean
  vercelEnvironment?: string
}

type ExtractionErrorResponse = {
  error?: string
  diagnostics?: ExtractionDiagnostics
}

function formatExtractionError(data: ExtractionErrorResponse) {
  const base = data.error ?? 'Failed to extract readable data from this PDF.'
  const diagnostics = data.diagnostics
  if (!diagnostics) return base

  return [
    base,
    `Endpoint host: ${diagnostics.endpointHost ?? 'unknown'}`,
    `Endpoint path: ${diagnostics.endpointPath || '/'}`,
    `Key length: ${diagnostics.keyLength ?? 0}`,
    `Looks like Cognitive Services: ${diagnostics.endpointLooksLikeCognitiveServices ? 'yes' : 'no'}`,
    `Vercel environment: ${diagnostics.vercelEnvironment ?? 'unknown'}`,
  ].join('\n')
}

function ResponseContent({ content }: { content: string }) {
  const blocks = parseBlocks(content)

  return (
    <div className="rounded-lg border border-an-border bg-an-bg-surface px-4 py-3">
      {blocks.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={URL.createObjectURL(new Blob([buildCombinedCSV(blocks)], { type: 'text/csv' }))}
            download="financial_data.csv"
            className="flex items-center gap-1.5 h-8 px-3 rounded border border-an-border text-body-sm text-an-fg-subtle hover:bg-an-bg-elevated hover:text-an-fg-base transition-colors"
          >
            <Download size={12} strokeWidth={1.5} />
            Download CSV
          </a>
          <button
            type="button"
            onClick={() => downloadExcel(content)}
            className="flex items-center gap-1.5 h-8 px-3 rounded bg-an-accent hover:bg-an-accent-hover text-white text-body-sm transition-colors"
          >
            <Download size={12} strokeWidth={1.5} />
            Download Excel
          </button>
        </div>
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
  const [file, setFile] = useState<UploadedFile | null>(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [pdfPageRange, setPdfPageRange] = useState('')
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
      const userId = localStorage.getItem('userId')
      if (!userId) {
        router.replace('/login')
        return
      }
      if (f.size > MAX_UPLOAD_BYTES) {
        setError(`File is too large. Upload files up to ${formatBytes(MAX_UPLOAD_BYTES)} while testing.`)
        return
      }

      const name = f.name
      const lower = name.toLowerCase()
      let text = ''
      let meta: ExtractionMeta | undefined

      if (lower.endsWith('.csv') || lower.endsWith('.txt') || lower.endsWith('.json')) {
        text = await f.text()
      } else if (lower.endsWith('.pdf')) {
        const { GlobalWorkerOptions, getDocument } = await import('pdfjs-dist')
        GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        const buf = await f.arrayBuffer()
        const pdf = await getDocument({ data: buf }).promise
        const pageCount = pdf.numPages
        await pdf.destroy()

        const pageRangeValidation = validatePdfPageRange(pdfPageRange, pageCount)
        if (pageRangeValidation.error) {
          setError(pageRangeValidation.error)
          return
        }

        if (!pageRangeValidation.normalized && pageCount > MAX_PDF_PAGES) {
          setError(`PDF has ${pageCount} pages. Enter a page range of up to ${MAX_PDF_PAGES} pages, or upload a shorter PDF.`)
          return
        }

        const formData = new FormData()
        formData.append('file', f)
        formData.append('userId', userId)
        if (pageRangeValidation.normalized) formData.append('pageRange', pageRangeValidation.normalized)

        const extractionRes = await fetch('/api/extract-file', {
          method: 'POST',
          body: formData,
        })
        const extractionData = await extractionRes.json()

        if (!extractionRes.ok) {
          setError(formatExtractionError(extractionData))
          return
        }

        text = extractionData.text ?? ''
        meta = {
          pageCount: extractionData.pageCount,
          totalPageCount: extractionData.totalPageCount,
          pageRange: extractionData.pageRange,
          tableCount: extractionData.tableCount,
          warning: extractionData.warning,
        }
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

      if (!text.trim()) {
        setError(
          lower.endsWith('.pdf')
            ? 'No readable text was found in this PDF. It may be scanned or image-based; use an OCR/text-based PDF or Excel/CSV export.'
            : 'No readable financial data was found in this file.'
        )
        return
      }

      setFile({ name, text, meta })
      const displayMessage = meta
        ? `Analyze ${name} (${meta.pageRange ? `pages ${meta.pageRange}, ` : ''}${meta.pageCount ?? 0} pages extracted, ${meta.tableCount ?? 0} tables found)`
        : `Analyze ${name}`
      await sendMessage(DEFAULT_EXTRACTION_PROMPT, {
        fileOverride: { name, text, meta },
        displayMessage,
      })
    } catch {
      setError('Failed to read file. Please try again.')
    } finally {
      setFileLoading(false)
    }
  }

  async function sendMessage(
    message: string,
    opts?: { fileOverride?: UploadedFile; displayMessage?: string }
  ) {
    if (!message || loading) return
    setError('')
    const activeFile = opts?.fileOverride ?? file
    const id = crypto.randomUUID()
    setMessages(prev => [...prev, { role: 'user', content: opts?.displayMessage ?? message, id }])
    setLoading(true)

    try {
      const res = await fetch('/api/normalize-financials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileText: activeFile?.text ?? '',
          fileName: activeFile?.name ?? '',
          userMessage: message,
          userId: localStorage.getItem('userId') ?? '',
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
                Upload a financial document (PDF, Excel, CSV) to normalize historical statements, computed cash flow, vertical analysis, horizontal analysis, and EBITDA.
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
                  <ResponseContent content={msg.content} />
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
                {file.meta && (
                  <span className="text-caption text-an-fg-muted">
                    {file.meta.pageRange ? `pages ${file.meta.pageRange} · ` : ''}
                    {file.meta.pageCount ?? 0}
                    {file.meta.totalPageCount ? `/${file.meta.totalPageCount}` : ''} pages · {file.meta.tableCount ?? 0} tables
                  </span>
                )}
                <button onClick={() => setFile(null)} className="text-an-fg-muted hover:text-an-fg-base transition-colors">
                  <X size={12} strokeWidth={2} />
                </button>
              </span>
              <a
                href={URL.createObjectURL(new Blob([file.text], { type: 'text/plain' }))}
                download={`${file.name}.extracted.txt`}
                className="text-caption text-an-accent hover:underline"
              >
                Download extraction
              </a>
            </div>
          )}
          {file?.meta?.warning && (
            <p className="text-caption text-an-warning mb-2">{file.meta.warning}</p>
          )}

          <div className="rounded-xl border border-an-border p-3" style={{ background: 'var(--an-bg-surface)' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Add an instruction for this normalization…"
              rows={1}
              disabled={loading}
              className="w-full bg-transparent border-none text-body text-an-fg-base placeholder:text-an-fg-muted resize-none focus:outline-none disabled:opacity-50 min-h-[24px] max-h-[200px] overflow-y-auto"
            />
            <div className="mt-3 rounded-lg border border-an-border bg-an-bg-subtle/70 px-3 py-2.5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0 flex-1">
                  <label htmlFor="pdf-page-range" className="text-caption font-medium text-an-fg-base">
                    Optional PDF pages
                  </label>
                  <p className="mt-0.5 text-caption text-an-fg-subtle">
                    Enter pages before uploading if you only want part of a PDF processed. Leave blank to use the whole file when it is within the limit.
                  </p>
                </div>
                <input
                  id="pdf-page-range"
                  value={pdfPageRange}
                  onChange={e => setPdfPageRange(e.target.value)}
                  disabled={fileLoading}
                  placeholder="1-8"
                  className="h-8 w-full rounded border border-an-border bg-an-bg-surface px-3 text-body-sm text-an-fg-base placeholder:text-an-fg-muted focus:outline-none focus:border-an-accent disabled:opacity-50 sm:w-32"
                />
              </div>
            </div>

            <div className="flex items-center justify-between mt-3">
              <div className="flex flex-wrap items-center gap-2">
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
                <span className="text-caption text-an-fg-muted">PDF, Excel, CSV, JSON, TXT · {formatBytes(MAX_UPLOAD_BYTES)} max · {MAX_PDF_PAGES} extracted PDF pages</span>
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

          {error && <p className="text-caption text-an-error text-center mt-2 whitespace-pre-wrap">{error}</p>}
        </div>
      </div>
    </div>
  )
}
