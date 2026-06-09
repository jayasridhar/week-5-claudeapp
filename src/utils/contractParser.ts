import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

export class ContractParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ContractParseError'
  }
}

async function parsePdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const pageTexts: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? (item as { str: string }).str : ''))
      .join(' ')
    pageTexts.push(pageText)
  }

  const text = pageTexts.join('\n\n').trim()
  if (!text) throw new ContractParseError('No text could be extracted from this PDF.')
  return text
}

async function parseTxt(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = (e.target?.result as string).trim()
      if (!text) reject(new ContractParseError('The text file appears to be empty.'))
      else resolve(text)
    }
    reader.onerror = () => reject(new ContractParseError('Failed to read the text file.'))
    reader.readAsText(file, 'utf-8')
  })
}

export async function parseContract(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const type = file.type.toLowerCase()

  if (type === 'application/pdf' || ext === 'pdf') {
    return parsePdf(file)
  }

  if (type === 'text/plain' || ext === 'txt') {
    return parseTxt(file)
  }

  throw new ContractParseError(
    `Unsupported file type: ${file.type || ext}. Please upload a PDF or TXT file.`
  )
}

export function getContractFileSizeWarning(file: File): string | null {
  const MB = 1024 * 1024
  if (file.size > 10 * MB) {
    return 'This file is large (>10 MB). Parsing may take a moment.'
  }
  return null
}
