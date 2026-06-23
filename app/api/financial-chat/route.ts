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
- Output ALL tables as plain comma-separated values (CSV). Every row must have exactly the same number of comma-separated fields as the header row. Count the commas — if the header has 11 commas, every data row must also have exactly 11 commas.
- NEVER concatenate adjacent numeric values without a comma between them. Each number, percentage, or projected value is a separate field and must be separated by a comma.
- Example of a CORRECT Balance Sheet row with 11 columns: Total Assets,84000,90200,100.00,100.00,7.38,96774,103879,111541,119836,128829,138601
- Example of a CORRECT Income Statement row: Net Sales,50000,52500,100.00,100.00,5.00,55125,57881,60775,63814,67005,70355
- The Vertical Analysis %, Horizontal YoY %, and all 6 projection year columns are each separate comma-separated fields — never run them together.
- Never mix tabs and commas in the same table.
- Never use Excel formula syntax. Write all formulas as plain text, e.g. "DSO = (Trade Receivables / Net Sales) x 365". Never output #NAME? or lines starting with "=".
- For metrics tables (DSO, DIO, DPO, CCC): Label,2023 value,2024 value — one row per metric, comma-separated throughout.`

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
