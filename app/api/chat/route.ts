import { NextRequest, NextResponse } from 'next/server'
import { DefaultAzureCredential } from '@azure/identity'

const AGENT_ENDPOINT = process.env.AZURE_AGENT_ENDPOINT_URL!
const AGENT_NAME = process.env.AZURE_AGENT_NAME!

const credential = new DefaultAzureCredential()

async function getToken(): Promise<string> {
  const tokenResponse = await credential.getToken('https://ai.azure.com/.default')
  return tokenResponse.token
}

const SYSTEM_PROMPT =
  'You are an AI assistant. Answer questions based solely on the document text provided. ' +
  'Always cite the specific section or part you are referencing. ' +
  'If the answer cannot be found in the provided text, say: "I cannot find this in the document." ' +
  'Do not speculate beyond what the document contains.'

export async function POST(req: NextRequest) {
  const { contractText, userMessage } = await req.json()
  if (!userMessage) {
    return NextResponse.json({ error: 'userMessage is required.' }, { status: 400 })
  }

  try {
    const token = await getToken()

    const messageContent = contractText
      ? `${SYSTEM_PROMPT}\n\nDocument text:\n${contractText}\n\nUser question: ${userMessage}`
      : `${SYSTEM_PROMPT}\n\nUser question: ${userMessage}`

    const response = await fetch(`${AGENT_ENDPOINT}/openai/v1/responses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: [{ role: 'user', content: messageContent }],
        agent_reference: {
          name: AGENT_NAME,
          type: 'agent_reference',
        },
        max_output_tokens: 32000,
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
