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
- Output ALL tables as plain comma-separated values (CSV). Do NOT wrap rows in double quotes. Every row must have exactly the same number of comma-separated fields as the header row.
- NEVER concatenate adjacent numeric values. Every number, percentage, and projected value is its own comma-separated field.
- The two Vertical Analysis % columns, the Horizontal YoY % column, and all 6 projection year columns are each separate fields separated by commas.
- CORRECT Balance Sheet row (12 fields): Account,2023,2024,Vertical 2023 %,Vertical 2024 %,Horizontal YoY %,2025,2026,2027,2028,2029,2030
- CORRECT Total Assets row: Total Assets,84000,90200,100.00,100.00,7.38,96774,103879,111541,119836,128829,138601
- CORRECT Net Sales row: Net Sales,50000,52500,100.00,100.00,5.00,55125,57881,60775,63814,67005,70355
- Use "Account" as the first column header in every table. Never use a section name (e.g. "Balance Sheet") as a column header.
- Do NOT include "Header explanation:", "Column order:", "Header:" or similar descriptor lines. The table header row itself is sufficient.
- For metrics tables (DSO, DIO, DPO, CCC): output only the final calculated numeric value in each cell, not the formula. CORRECT: DSO = (Trade Receivables / Net Sales) x 365,52.56,51.60. WRONG: DSO,...,(7200/50000)*365=52.56,...
- Never use Excel formula syntax. Never output #NAME? or lines starting with "=".
- Separate each section with a markdown heading (### Balance Sheet, ### Income Statement, etc.) on its own line.
- ALWAYS include a ### Company Overview section at the top with: Company name, reporting currency, and reporting unit (e.g. "Amounts in actual CAD" or "Amounts in CAD 000s"). Determine the unit from the source document — small businesses typically report in actual dollars, not thousands. State it explicitly so downstream analysis does not misinterpret the scale.`

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
