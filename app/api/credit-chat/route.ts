import { NextRequest, NextResponse } from 'next/server'
import { getAzureHeaders } from '@/lib/azure-auth'
import { countAnalysesSince } from '@/lib/db'
import {
  getDailyAnalysisLimit,
  getDailyLimitMessage,
  getTodayStartIso,
  MAX_EXTRACTED_TEXT_CHARS,
} from '@/lib/usage-limits'

const AGENT_ENDPOINT = process.env.AZURE_AGENT_ENDPOINT_URL!
const AGENT_NAME = process.env.AZURE_CREDIT_AGENT_NAME!

function isMissingDocsOnlyRequest(message: string | undefined): boolean {
  if (!message) return false
  return /\b(what|which|list|show|tell me).{0,60}\b(missing|needed|required|additional).{0,60}\b(document|documents|data|information|details)\b/i.test(message)
}

function isContinueRequest(message: string | undefined): boolean {
  if (!message) return false
  return /\b(continue|keep going|go ahead|proceed|move forward|no additional|nothing else|use what (we|you) have|without additional|no more documents|no more docs)\b/i.test(message)
}

export async function POST(req: NextRequest) {
  const { normalizedText, userMessage, userId } = await req.json()
  if (!userId) {
    return NextResponse.json({ error: 'Login is required before running credit analysis.' }, { status: 401 })
  }
  if (!normalizedText) {
    return NextResponse.json({ error: 'normalizedText is required.' }, { status: 400 })
  }
  if (normalizedText.length > MAX_EXTRACTED_TEXT_CHARS) {
    return NextResponse.json(
      { error: 'The financial data is too large for the testing guardrail. Use a shorter document or split it into smaller files.' },
      { status: 413 }
    )
  }

  try {
    const usedToday = await countAnalysesSince(userId, 'credit', getTodayStartIso())
    if (usedToday >= getDailyAnalysisLimit('credit')) {
      return NextResponse.json({ error: getDailyLimitMessage('credit') }, { status: 429 })
    }

    const headers = await getAzureHeaders()
    const missingDocsOnly = isMissingDocsOnlyRequest(userMessage)
    const continueWithAvailableData = isContinueRequest(userMessage)

    const formatInstructions = `Follow the credit-readiness agent's configured methodology exactly.

App-side formatting guardrails:
- Use Markdown headings and Markdown pipe tables only.
- Do NOT use LaTeX notation. Never write \\[, \\], \\frac{}{}, \\text{}, or any LaTeX math syntax.
- Show formulas as plain inline text.
- Do not create separate CSV sections or headings that end in "CSV".
- Missing documentation is optional follow-up, not a hard stop. Unless the user explicitly asks only for missing documents/data, produce the full credit-readiness report using the available information.
- If data needed for lender-grade DSCR, FCCR, debt capacity, or readiness conclusions is missing, do not invent values. Show "Not provided" or "Not calculable from provided data" in the relevant table cells, explain the limitation briefly, and list the optional documentation/details in section 6.
- If the user says continue, keep going, proceed, go ahead, use what is available, or says they have no additional documents, immediately produce the full report using only the available information.
- When producing the final credit-readiness report, preserve the required main report structure exactly:
  # Canadian Commercial Credit Readiness Assessment
  ## 1. Credit Snapshot
  ## 2. Basis of Analysis and Data Quality
  ## 3. Financial Performance
  ## 4. Leverage and Debt Service
  ## 5. Liquidity and Working Capital
  ## 6. Key Credit Risks, Mitigants, and Required Follow-Up
  ## 7. Indicative Debt Capacity
  ## 8. Credit Readiness Conclusion
- In a final report, do not rename, omit, merge, or reorder those eight sections.
- Keep tables concise enough to render cleanly in the app and PDF export.
- Do not end with an offer to prepare further reports.`

    const taskInstructions = missingDocsOnly
      ? 'The user is asking specifically for missing documentation/data. Answer that request concisely and do not produce the full report unless the user also asks to continue.'
      : continueWithAvailableData
        ? 'The user wants to continue without uploading an additional PDF or other supporting documents. Produce the full eight-section credit readiness assessment now using only the normalized financial data provided. Include missing items as limitations and optional follow-up in section 6.'
        : 'Produce the full eight-section credit readiness assessment now using the normalized financial data provided. Include missing items as limitations and optional follow-up in section 6 instead of stopping before the report.'

    const messageContent = userMessage
      ? `${formatInstructions}\n\nTask instruction: ${taskInstructions}\n\nUser message:\n${userMessage}\n\nNormalized financial data:\n${normalizedText}`
      : `${formatInstructions}\n\nTask instruction: ${taskInstructions}\n\nNormalized financial data:\n${normalizedText}`

    const response = await fetch(`${AGENT_ENDPOINT}/openai/v1/responses`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        input: [{ role: 'user', content: messageContent }],
        agent_reference: {
          name: AGENT_NAME,
          type: 'agent_reference',
        },
        max_output_tokens: 12000,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('[credit-chat] Azure error:', response.status, err)
      return NextResponse.json({ error: `Azure error: ${err}` }, { status: 502 })
    }

    const data = await response.json()
    const messageOutputs = data.output?.filter(
      (o: any) => o.type === 'message' && o.agent_reference?.name === AGENT_NAME
    ) ?? []
    const content: string =
      messageOutputs
        .flatMap((o: any) => o.content?.filter((c: any) => c.type === 'output_text') ?? [])
        .map((c: any) => c.text)
        .join('\n') || data.output_text || ''

    if (data.status === 'incomplete') {
      console.warn('[credit-chat] Response truncated:', data.incomplete_details)
    }

    return NextResponse.json({ content, truncated: data.status === 'incomplete' })
  } catch (err) {
    console.error('[credit-chat]', err)
    const message = err instanceof Error ? err.message : JSON.stringify(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
