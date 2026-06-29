import { NextRequest, NextResponse } from 'next/server'
import { DefaultAzureCredential } from '@azure/identity'

const AGENT_ENDPOINT = process.env.AZURE_AGENT_ENDPOINT_URL!
const AGENT_NAME = process.env.AZURE_CREDIT_AGENT_NAME!

const credential = new DefaultAzureCredential()

async function getToken(): Promise<string> {
  const tokenResponse = await credential.getToken('https://ai.azure.com/.default')
  return tokenResponse.token
}

export async function POST(req: NextRequest) {
  const { normalizedText, userMessage } = await req.json()
  if (!normalizedText) {
    return NextResponse.json({ error: 'normalizedText is required.' }, { status: 400 })
  }

  try {
    const token = await getToken()

    const formatInstructions = `You are a senior Canadian credit analyst preparing a credit readiness assessment for a commercial lender. Apply rigorous, lender-grade methodology throughout.

ANALYTICAL RULES (critical — follow exactly):

1. UNITS: Always state the reporting currency and unit (e.g. CAD 000s) at the top. Apply that unit consistently to every number and conclusion. Never confuse thousands with actual dollars.

2. EBITDA: Use the correct formula: EBITDA = Net Income + Interest Expense + Income Taxes + Depreciation + Amortization. Never omit interest expense. If interest expense is not explicitly stated, estimate it from average debt balance × a stated assumed rate (e.g. 5–7%) and flag the assumption clearly.

3. PRINCIPAL REPAYMENTS: Do NOT use the change in total debt as a proxy for principal repayments. Debt balances change for many reasons (refinancing, FX, reclassification). Use the scheduled principal repayments from the cash flow statement if available; otherwise state the limitation explicitly.

4. DSCR / FCCR: Use DSCR = (EBITDA - Unfunded Capex - Taxes Paid) / (Principal + Interest). Use FCCR = (EBITDA + Lease Payments) / (Interest + Principal + Lease Payments). Never assume interest = 0 when material debt exists.

5. ANOMALY INVESTIGATION: Flag and investigate unusual metrics rather than accepting them as positive. Examples: Current ratio > 5 requires explanation (large cash, shareholder receivables, holding structure). ROA > 15% requires explanation (asset-light model, one-time gains, revaluation). Investigate before concluding.

6. INCREMENTAL CREDIT CAPACITY: Base the maximum additional debt on DSCR threshold AND Debt/EBITDA (typical Canadian bank limit: 3.0–4.0x senior). Use the more conservative constraint. Show the sanity check: (Current Debt + New Debt) / EBITDA = X.

7. LENDER PERSPECTIVE: Acknowledge what a lender would require beyond ratios — collateral, covenants, security, industry context, customer concentration, cash flow volatility. Do not present a single-metric conclusion as definitive.

8. LIMITATIONS: Explicitly state what data is missing and how it affects the analysis (e.g. no interest expense line, no debt maturity schedule, no notes to financial statements).

FORMATTING RULES:
- Do NOT use LaTeX notation. Never write \\[, \\], \\frac{}{}, \\text{}, or any LaTeX math syntax.
- Show all formulas as plain inline text. Example: FCCR = (EBITDA) / (Interest + Principal) = 333253 / 77777 = 4.28
- Output metric tables as plain CSV with headers: Metric,Value,Benchmark,Assessment
- Use ### headings to separate sections: ### Units and Data Quality, ### EBITDA Build, ### Key Credit Metrics, ### Anomaly Flags, ### Incremental Credit Capacity, ### Limitations
- Keep each section concise. State the formula, result, and one-line interpretation.
- Do not end with an offer to prepare further reports.`

    const messageContent = userMessage
      ? `${formatInstructions}\n\n${userMessage}\n\nNormalized financial data:\n${normalizedText}`
      : `${formatInstructions}\n\nProvide a credit readiness assessment based on the following normalized financial data:\n\n${normalizedText}`

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
