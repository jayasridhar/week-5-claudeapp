import { NextRequest, NextResponse } from 'next/server'
import { getAzureHeaders } from '@/lib/azure-auth'

const AGENT_ENDPOINT = process.env.AZURE_AGENT_ENDPOINT_URL!
const AGENT_NAME = process.env.AZURE_FINANCIAL_AGENT_NAME!

function buildCurrencyGuard(fileText: string) {
  const lower = fileText.toLowerCase()
  const hasCanadianSignal =
    /\bcad\b|\bcdn\b|\bcanadian\b|\bcanada\b|\bontario\b|\btoronto\b|\bhst\b|\bgst\/hst\b|\bcra\b/.test(lower)
  const hasInrSignal = /\binr\b|\brs\.?\b|\brupees?\b|\blakhs?\b|\bcrores?\b/.test(lower)

  if (hasCanadianSignal && !hasInrSignal) {
    return 'Currency guard: The extracted document contains Canadian/CAD indicators and no INR indicators. Report currency as CAD. Do not report INR, Rs, rupees, lakhs, or crores.'
  }

  return 'Currency guard: Report INR/Rs/rupees/lakhs/crores only if those exact currency/unit indicators appear in the uploaded source text. If the source text does not contain them, INR is invalid. If the source text contains CAD/Canada/Canadian indicators, report CAD.'
}

function enforceCurrencyGuard(content: string, fileText: string) {
  const hasInrSignal = /\binr\b|\brs\.?\b|\brupees?\b|\blakhs?\b|\bcrores?\b/i.test(fileText)
  if (hasInrSignal) return content

  return content
    .replace(/(Reporting Currency\s*,\s*)INR\b/gi, '$1CAD')
    .replace(/(Reporting Currency\s*\t\s*)INR\b/gi, '$1CAD')
    .replace(/(Reporting Currency\s*[:|-]\s*)INR\b/gi, '$1CAD')
    .replace(/(Reporting Unit\s*,\s*Amounts in actual\s+)INR\b/gi, '$1CAD')
    .replace(/(Reporting Unit\s*\t\s*Amounts in actual\s+)INR\b/gi, '$1CAD')
    .replace(/(Reporting Unit\s*[:|-]\s*Amounts in actual\s+)INR\b/gi, '$1CAD')
    .replace(/(Reporting Unit\s*,\s*Amounts in\s+)INR\b/gi, '$1CAD')
    .replace(/(Reporting Unit\s*\t\s*Amounts in\s+)INR\b/gi, '$1CAD')
    .replace(/(Reporting Unit\s*[:|-]\s*Amounts in\s+)INR\b/gi, '$1CAD')
}

export async function POST(req: NextRequest) {
  const { fileText, fileName, userMessage } = await req.json()
  if (!userMessage) {
    return NextResponse.json({ error: 'userMessage is required.' }, { status: 400 })
  }

  try {
    const headers = await getAzureHeaders()

    const formatInstructions = `FORMATTING RULES (follow exactly):
- Use ONLY the uploaded source text in this request. Do not use example companies, previous runs, memorized demo data, or values from agent instructions. If a line item is not present in the uploaded source text, leave it blank and state that it was not provided.
- The company name must come from the uploaded source text only. Never replace it with a sample or prior company name.
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
- ALWAYS include a ### Company Overview section at the top with: Company name, reporting currency, and reporting unit (e.g. "Amounts in actual CAD" or "Amounts in CAD 000s"). Determine the unit from the source document — small businesses typically report in actual dollars, not thousands. State it explicitly so downstream analysis does not misinterpret the scale.
- Never use INR, Rs, rupees, lakhs, or crores unless the uploaded source document explicitly states that currency or unit. If the source document does not specify a currency, write "Reporting Currency,Unknown (not specified)" instead of assuming a currency.`

    const messageContent = fileText
      ? `${formatInstructions}\n\n${buildCurrencyGuard(fileText)}\n\nFile: ${fileName}\n\n${fileText}\n\nUser question: ${userMessage}`
      : `${formatInstructions}\n\n${userMessage}`

    const response = await fetch(`${AGENT_ENDPOINT}/openai/v1/responses`, {
      method: 'POST',
      headers,
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
    const rawContent: string =
      messageOutputs
        .flatMap((o: any) => o.content?.filter((c: any) => c.type === 'output_text') ?? [])
        .map((c: any) => c.text)
        .join('\n') || data.output_text || ''
    const content = enforceCurrencyGuard(rawContent, fileText ?? '')

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
