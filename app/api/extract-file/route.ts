import { NextRequest, NextResponse } from 'next/server'

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

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'A file upload is required.' }, { status: 400 })
    }

    const lowerName = file.name.toLowerCase()
    if (!lowerName.endsWith('.pdf') && !file.type.includes('pdf')) {
      return NextResponse.json({ error: 'Only PDF extraction is supported by this route.' }, { status: 400 })
    }

    const result = await analyzeDocument(file)
    if (!result.content.trim()) {
      return NextResponse.json(
        { error: 'No readable text or tables were extracted from this PDF.' },
        { status: 422 }
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
