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

    const formatInstructions = `FORMATTING RULES (follow exactly):
- Do NOT use LaTeX notation. Never write \\[, \\], \\frac{}{}, \\text{}, or any LaTeX math syntax.
- Show all formulas and calculations as plain inline text. CORRECT: FCCR = (EBIT + Interest) / (Interest + Principal) = 15225 / 4463 = 3.41. WRONG: \\[\\text{FCCR} = \\frac{...}\\]
- Output metric comparison tables as plain CSV with headers. Example: Metric,Value,Benchmark,Assessment
- Keep explanations concise. State the metric, the formula in plain text, the result, and the interpretation. Skip lengthy preambles about data availability or assumptions.
- Use ### headings (e.g. ### Key Credit Metrics, ### Benchmarks, ### Credit Capacity) to separate sections.
- Do not end with an offer to prepare further reports or ask how to proceed.`

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
