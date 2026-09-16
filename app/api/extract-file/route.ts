import { NextRequest, NextResponse } from 'next/server'
import { countAnalysesSince } from '@/lib/db'
import {
  getDailyAnalysisLimit,
  getDailyLimitMessage,
  getTodayStartIso,
  MAX_EXTRACTED_TEXT_CHARS,
  MAX_PDF_PAGES,
  MAX_UPLOAD_BYTES,
  formatBytes,
} from '@/lib/usage-limits'

const API_VERSION = '2024-11-30'
const MODEL_ID = 'prebuilt-layout'
const POLL_INTERVAL_MS = 1000
const MAX_POLLS = 60

type DocumentIntelligenceConfig = {
  endpoint: string
  key: string
}

function cleanEnvValue(value: string | undefined) {
  return value?.trim().replace(/^['"]|['"]$/g, '')
}

function getDocumentIntelligenceConfig(): DocumentIntelligenceConfig {
  const endpoint = cleanEnvValue(process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT)
    ?.replace(/\/$/, '')
    .replace(/\/documentintelligence$/i, '')
  const key = cleanEnvValue(process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY)

  if (!endpoint || !key) {
    throw new Error(
      'Azure Document Intelligence is not configured. Add AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_KEY.'
    )
  }

  return { endpoint, key }
}

function getConfigDiagnostics(config?: Partial<DocumentIntelligenceConfig>) {
  const endpoint = config?.endpoint ?? cleanEnvValue(process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT)
  const key = config?.key ?? cleanEnvValue(process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY)
  let endpointHost = 'missing'
  let endpointPath = ''

  if (endpoint) {
    try {
      const url = new URL(endpoint)
      endpointHost = url.host
      endpointPath = url.pathname
    } catch {
      endpointHost = 'invalid-url'
    }
  }

  return {
    endpointHost,
    endpointPath,
    keyLength: key?.length ?? 0,
    endpointLooksLikeCognitiveServices: endpointHost.endsWith('.cognitiveservices.azure.com'),
    vercelEnvironment: process.env.VERCEL_ENV ?? 'local-or-unknown',
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getOperationId(operationLocation: string) {
  try {
    const url = new URL(operationLocation)
    return url.pathname.split('/').filter(Boolean).pop() ?? operationLocation
  } catch {
    return operationLocation
  }
}

async function estimatePdfPageCount(file: File) {
  const bytes = Buffer.from(await file.arrayBuffer())
  const raw = bytes.toString('latin1')
  return (raw.match(/\/Type\s*\/Page\b/g) ?? []).length
}

async function analyzeDocument(file: File) {
  const { endpoint, key } = getDocumentIntelligenceConfig()
  const bytes = Buffer.from(await file.arrayBuffer())
  const base64Source = bytes.toString('base64')
  const analyzeUrl =
    `${endpoint}/documentintelligence/documentModels/${MODEL_ID}:analyze` +
    `?_overload=analyzeDocument&api-version=${API_VERSION}&outputContentFormat=markdown`

  const analyzeResponse = await fetch(analyzeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': key,
    },
    body: JSON.stringify({ base64Source }),
  })

  if (!analyzeResponse.ok) {
    const error = await analyzeResponse.text()
    const message = `Document Intelligence analyze failed (${analyzeResponse.status}): ${error}`
    throw Object.assign(new Error(message), {
      status: analyzeResponse.status,
      diagnostics: getConfigDiagnostics({ endpoint, key }),
    })
  }

  const operationLocation = analyzeResponse.headers.get('operation-location')
  if (!operationLocation) {
    throw new Error('Document Intelligence did not return an operation-location header.')
  }

  for (let poll = 0; poll < MAX_POLLS; poll++) {
    await sleep(POLL_INTERVAL_MS)

    const resultResponse = await fetch(operationLocation, {
      headers: { 'Ocp-Apim-Subscription-Key': key },
    })

    if (!resultResponse.ok) {
      const error = await resultResponse.text()
      throw new Error(`Document Intelligence result failed (${resultResponse.status}): ${error}`)
    }

    const result = await resultResponse.json()
    if (result.status === 'succeeded') {
      const content = result.analyzeResult?.content ?? ''
      return {
        content,
        operationId: getOperationId(operationLocation),
        pageCount: result.analyzeResult?.pages?.length ?? 0,
        tableCount: result.analyzeResult?.tables?.length ?? 0,
      }
    }

    if (result.status === 'failed') {
      throw new Error(`Document Intelligence failed: ${JSON.stringify(result.error ?? result)}`)
    }
  }

  throw new Error('Document Intelligence timed out while extracting the file.')
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    const userId = formData.get('userId')

    if (typeof userId !== 'string' || !userId) {
      return NextResponse.json({ error: 'Login is required before extracting a PDF.' }, { status: 401 })
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'A file upload is required.' }, { status: 400 })
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File is too large. Upload files up to ${formatBytes(MAX_UPLOAD_BYTES)}.` },
        { status: 413 }
      )
    }

    const usedToday = await countAnalysesSince(userId, 'financial', getTodayStartIso())
    if (usedToday >= getDailyAnalysisLimit('financial')) {
      return NextResponse.json({ error: getDailyLimitMessage('financial') }, { status: 429 })
    }

    const lowerName = file.name.toLowerCase()
    if (!lowerName.endsWith('.pdf') && !file.type.includes('pdf')) {
      return NextResponse.json({ error: 'Only PDF extraction is supported by this route.' }, { status: 400 })
    }

    const estimatedPageCount = await estimatePdfPageCount(file)
    if (estimatedPageCount > MAX_PDF_PAGES) {
      return NextResponse.json(
        { error: `PDF has ${estimatedPageCount} pages. Upload PDFs up to ${MAX_PDF_PAGES} pages while testing.` },
        { status: 413 }
      )
    }

    const result = await analyzeDocument(file)
    if (!result.content.trim()) {
      return NextResponse.json(
        { error: 'No readable text or tables were extracted from this PDF.' },
        { status: 422 }
      )
    }
    if (result.content.length > MAX_EXTRACTED_TEXT_CHARS) {
      return NextResponse.json(
        { error: `Extracted text is too large for the testing guardrail. Use a shorter document or split it into smaller files.` },
        { status: 413 }
      )
    }

    const warning = result.pageCount === 2
      ? 'Only 2 pages were extracted. If this PDF has more pages, check whether Azure Document Intelligence is using the Free (F0) tier, which processes only the first two pages.'
      : undefined

    return NextResponse.json({
      text: result.content,
      operationId: result.operationId,
      pageCount: result.pageCount,
      tableCount: result.tableCount,
      warning,
    })
  } catch (err) {
    console.error('[extract-file]', err)
    const message = err instanceof Error ? err.message : 'Failed to extract the file.'
    const diagnostics = typeof err === 'object' && err !== null && 'diagnostics' in err
      ? (err as { diagnostics?: unknown }).diagnostics
      : getConfigDiagnostics()
    return NextResponse.json({ error: message, diagnostics }, { status: 500 })
  }
}
