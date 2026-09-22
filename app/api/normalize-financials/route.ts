import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import { countAnalysesSince } from '@/lib/db'
import {
  getDailyAnalysisLimit,
  getDailyLimitMessage,
  getTodayStartIso,
  MAX_EXTRACTED_TEXT_CHARS,
} from '@/lib/usage-limits'

export const runtime = 'nodejs'

const PYTHON_CANDIDATES = [process.env.PYTHON_BIN, 'python3', 'python'].filter(Boolean) as string[]

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const message = (err as { message?: unknown }).message
    if (typeof message === 'string' && message) return message
  }
  try {
    return JSON.stringify(err)
  } catch {
    return 'Financial normalization failed.'
  }
}

async function enforceDailyLimit(userId: string) {
  try {
    const usedToday = await countAnalysesSince(userId, 'financial', getTodayStartIso())
    if (usedToday >= getDailyAnalysisLimit('financial')) {
      return getDailyLimitMessage('financial')
    }
    return null
  } catch (err) {
    const message = getErrorMessage(err)
    console.warn('[normalize-financials] Skipping local daily-limit check:', message)

    if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
      return null
    }

    throw new Error(`Could not verify the daily analysis limit: ${message}`)
  }
}

async function runNormalizer(payload: { fileText: string; fileName?: string; userMessage?: string }) {
  const scriptPath = path.join(process.cwd(), 'scripts', 'financial_normalizer.py')
  const input = JSON.stringify(payload)
  let lastError: unknown

  for (const pythonBin of PYTHON_CANDIDATES) {
    try {
      const stdout = await new Promise<string>((resolve, reject) => {
        const child = spawn(pythonBin, [scriptPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
        })
        let out = ''
        let err = ''
        const timer = setTimeout(() => {
          child.kill('SIGKILL')
          reject(new Error('Python normalizer timed out.'))
        }, 30_000)

        child.stdout.setEncoding('utf8')
        child.stderr.setEncoding('utf8')
        child.stdout.on('data', chunk => { out += chunk })
        child.stderr.on('data', chunk => { err += chunk })
        child.on('error', reject)
        child.on('close', code => {
          clearTimeout(timer)
          if (code === 0) resolve(out)
          else reject(new Error(err || `Python normalizer exited with status ${code}.`))
        })
        child.stdin.end(input)
      })
      return JSON.parse(stdout) as { content: string }
    } catch (err) {
      lastError = err
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Python normalizer failed.')
}

export async function POST(req: NextRequest) {
  const { fileText = '', fileName = '', userMessage = '', userId = '' } = await req.json()

  if (!userId) {
    return NextResponse.json({ error: 'Login is required before running financial normalization.' }, { status: 401 })
  }

  if (!fileText.trim()) {
    return NextResponse.json(
      { error: 'No readable text was extracted from the uploaded file. Use OCR extraction or upload Excel/CSV data.' },
      { status: 400 }
    )
  }

  if (fileText.length > MAX_EXTRACTED_TEXT_CHARS) {
    return NextResponse.json(
      { error: 'The extracted document text is too large for the testing guardrail. Use a shorter document or split it into smaller files.' },
      { status: 413 }
    )
  }

  try {
    const limitError = await enforceDailyLimit(userId)
    if (limitError) {
      return NextResponse.json({ error: limitError }, { status: 429 })
    }

    const result = await runNormalizer({ fileText, fileName, userMessage })
    return NextResponse.json({ content: result.content })
  } catch (err) {
    console.error('[normalize-financials]', err)
    const message = getErrorMessage(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
