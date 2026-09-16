import { NextRequest, NextResponse } from 'next/server'
import { getAzureHeaders } from '@/lib/azure-auth'
import { MAX_EXTRACTED_TEXT_CHARS } from '@/lib/usage-limits'

const AGENT_ENDPOINT = process.env.AZURE_AGENT_ENDPOINT_URL!
const AGENT_NAME = process.env.AZURE_AGENT_NAME!

const SYSTEM_PROMPT =
  'You are an AI assistant. Answer questions based solely on the document text provided. ' +
  'Always cite the specific section or part you are referencing. ' +
  'If the answer cannot be found in the provided text, say: "I cannot find this in the document." ' +
  'Do not speculate beyond what the document contains.'

export async function POST(req: NextRequest) {
  const { contractText, userMessage, userId } = await req.json()
  if (!userId) {
    return NextResponse.json({ error: 'Login is required before running AI chat.' }, { status: 401 })
  }
  if (!userMessage) {
    return NextResponse.json({ error: 'userMessage is required.' }, { status: 400 })
  }
  if ((contractText ?? '').length > MAX_EXTRACTED_TEXT_CHARS) {
    return NextResponse.json(
      { error: 'The document text is too large for the testing guardrail. Use a shorter document or split it into smaller files.' },
      { status: 413 }
    )
  }

  try {
    const headers = await getAzureHeaders()

    const messageContent = contractText
      ? `${SYSTEM_PROMPT}\n\nDocument text:\n${contractText}\n\nUser question: ${userMessage}`
      : `${SYSTEM_PROMPT}\n\nUser question: ${userMessage}`

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
      console.error('[chat] Azure error:', response.status, err)
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
      console.warn('[chat] Response truncated:', data.incomplete_details)
    }

    return NextResponse.json({ content, truncated: data.status === 'incomplete' })
  } catch (err) {
    console.error('[chat]', err)
    const message = err instanceof Error ? err.message : JSON.stringify(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
