import { NextRequest, NextResponse } from 'next/server'
import { DefaultAzureCredential } from '@azure/identity'

const AGENT_ENDPOINT = process.env.AZURE_AGENT_ENDPOINT_URL!
const AGENT_NAME = process.env.AZURE_FINANCIAL_AGENT_NAME!

const credential = new DefaultAzureCredential()

async function getToken(): Promise<string> {
  const tokenResponse = await credential.getToken('https://ai.azure.com/.default')
  return tokenResponse.token
}

export async function POST(req: NextRequest) {
  const { fileText, fileName, userMessage } = await req.json()
  if (!userMessage) {
    return NextResponse.json({ error: 'userMessage is required.' }, { status: 400 })
  }

  try {
    const token = await getToken()

    const formatInstructions = `FORMATTING RULES (follow exactly):
- All tables must use comma-separated values consistently. Never mix tabs and commas in the same table.
- Every table row must have the same number of comma-separated fields as the header row. Never concatenate values directly onto a label with no separator.
- Never use Excel formula syntax. Write all formulas as plain text, e.g. "DSO = (Trade Receivables / Net Sales) × 365". Never start a line with "=". Never output #NAME? or other spreadsheet error strings.
- For metrics tables (DSO, DIO, DPO, CCC), always use this format: Label,2023 value,2024 value — one row per metric, comma-separated, same delimiter throughout.`

    const messageContent = fileText
      ? `${formatInstructions}\n\nFile: ${fileName}\n\n${fileText}\n\nUser question: ${userMessage}`
      : `${formatInstructions}\n\n${userMessage}`

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
      console.error('[financial-chat] Azure error:', response.status, err)
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
      console.warn('[financial-chat] Response truncated:', data.incomplete_details)
    }

    return NextResponse.json({ content, truncated: data.status === 'incomplete' })
  } catch (err) {
    console.error('[financial-chat]', err)
    const message = err instanceof Error ? err.message : JSON.stringify(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
