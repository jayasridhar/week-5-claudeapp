# Prompt: Integrate Azure AI Foundry Agent into LegalGraph

Use this prompt verbatim with Claude to wire up the complete Azure AI backend.
This prompt was validated end-to-end — follow it exactly.

---

## THE PROMPT

You are integrating an Azure AI Foundry agent into an existing Next.js app called LegalGraph — a legal contract chat assistant. The frontend is fully built. The backend chat route is a placeholder. Your job is to replace the placeholder with a real Azure AI integration that works end to end.

---

## BEFORE YOU WRITE A SINGLE LINE OF CODE — ask the user for these two values

```
AZURE_API_KEY          — Azure AI Foundry project → Settings → API keys → copy the key value
AZURE_AGENT_ENDPOINT   — see instructions below
```

### How to find AZURE_AGENT_ENDPOINT

This is NOT the Azure OpenAI endpoint. It is the agent-specific endpoint from Azure AI Foundry.

1. Go to [ai.azure.com](https://ai.azure.com) → open your project
2. Click **Agents** in the left menu
3. Open your agent
4. Look for **Endpoint** or **Agent endpoint** — it follows this pattern:

```
https://{resource}.services.ai.azure.com/api/projects/{project}/agents/{agent-name}/endpoint/protocols/openai
```

Example:
```
https://red-teaming-lab-cohort-resource.services.ai.azure.com/api/projects/red-teaming-lab-cohort/agents/demoagen/endpoint/protocols/openai
```

That is the full value for `AZURE_AGENT_ENDPOINT`. Do not append anything to it.

Do not use:
- The Azure OpenAI resource URL (`openai.azure.com/...`) — wrong endpoint
- The project inference URL (`services.ai.azure.com/openai/v1`) — requires a model deployment name
- The project URL without `/agents/{name}/endpoint/protocols/openai` — won't route to the agent

---

## WHAT ALREADY EXISTS — do not rebuild any of this

- `app/api/chat/route.ts` — placeholder. You will replace this.
- `lib/db.ts` — has `createMessage(sessionId, role, content)`. Use it.
- `app/dashboard/page.tsx` — sends `POST /api/chat` with `{ sessionId, userMessage, contractText }`.

The frontend expects back:
```json
{
  "assistantMessage": "string",
  "userMessageId": "uuid",
  "assistantMessageId": "uuid"
}
```

---

## WHAT TO BUILD

### 1. Add to .env.local

```env
AZURE_API_KEY=<key from AI Foundry project settings>
AZURE_AGENT_ENDPOINT=https://{resource}.services.ai.azure.com/api/projects/{project}/agents/{agent-name}/endpoint/protocols/openai
```

### 2. Create `lib/azure.ts`

```typescript
import OpenAI from 'openai'

let client: OpenAI | null = null

export function getAzureClient(): OpenAI {
  if (client) return client

  const apiKey = process.env.AZURE_API_KEY
  const baseURL = process.env.AZURE_AGENT_ENDPOINT

  if (!apiKey || !baseURL) {
    throw new Error('Missing Azure env vars: AZURE_API_KEY, AZURE_AGENT_ENDPOINT')
  }

  client = new OpenAI({
    baseURL,
    apiKey,
    defaultHeaders: { 'api-key': apiKey },
    defaultQuery: { 'api-version': '2025-05-15-preview' },
  })

  return client
}
```

### 3. Replace `app/api/chat/route.ts`

```typescript
import { NextRequest } from 'next/server'
import { createMessage } from '@/lib/db'
import { getAzureClient } from '@/lib/azure'

const FALLBACK = 'I was unable to get a response from the AI agent. Please try again.'

export async function POST(req: NextRequest) {
  const { sessionId, userMessage, contractText } = await req.json()

  if (!sessionId || !userMessage) {
    return Response.json({ error: 'sessionId and userMessage are required' }, { status: 400 })
  }

  const userMsg = await createMessage(sessionId, 'user', userMessage)

  let assistantText = FALLBACK

  try {
    const openai = getAzureClient()

    const combinedInput = contractText
      ? `CONTRACT TEXT:\n${contractText}\n\nUSER QUESTION:\n${userMessage}`
      : userMessage

    const response = await (openai.responses.create as Function)({
      input: [{ role: 'user', content: combinedInput }],
    })

    const firstOutput = response.output?.find((o: { type: string }) => o.type === 'message')
    const rawText = firstOutput?.content?.find((c: { type: string }) => c.type === 'output_text')?.text
    assistantText = response.output_text ?? rawText ?? FALLBACK
  } catch (err: unknown) {
    console.error('Azure chat error:', err)
    const httpStatus = (err as { status?: number }).status ?? 0
    if (httpStatus === 401 || httpStatus === 403) {
      await createMessage(sessionId, 'assistant', FALLBACK)
      return Response.json({ error: 'Azure authentication failed.' }, { status: httpStatus })
    }
  }

  const assistantMsg = await createMessage(sessionId, 'assistant', assistantText)

  return Response.json({
    assistantMessage: assistantText,
    userMessageId: userMsg.id,
    assistantMessageId: assistantMsg.id,
  })
}
```

### 4. Update `next.config.mjs`

Add `@azure/ai-projects` and `@azure/identity` to `serverExternalPackages` if present.
The `openai` package does not need to be listed — it is handled by Next.js automatically.

### 5. Install dependencies

```bash
npm install openai --legacy-peer-deps
```

---

## WHAT DOES NOT WORK — do not attempt these

| Approach | Why it fails |
|---|---|
| Azure OpenAI endpoint (`openai.azure.com`) | Requires a model deployment name — fails with `DeploymentNotFound` if the name is wrong |
| Project inference endpoint (`services.ai.azure.com/.../openai/v1`) | Requires `model` param — fails with `Missing required parameter: 'model'` |
| Agent endpoint with service principal (Entra ID) | Requires `Azure AI Developer` role on the project — fails with 403 unless IAM is configured |
| API key as Bearer token via `AIProjectClient` | Agent-specific endpoint rejects it with 401 `missing Authorization header` |
| Passing `agent_reference` in `extra_body` | Not needed when using the agent endpoint URL — the endpoint already routes to the agent |
| `api-version: 2024-12-01-preview` | Not supported on this endpoint — fails with `API version not supported` |

---

## HOW TO VERIFY IT WORKS

1. `npm run dev`
2. Open http://localhost:3000, log in, click New chat
3. Attach a PDF contract
4. Ask: "Summarise this contract in two sentences"
5. Expected: real AI response from the agent appears in the chat

If you get an error:
- **401**: API key is wrong or missing `api-key` header
- **403**: API key valid but not authorized — check the key is from the correct AI Foundry project
- **400 API version not supported**: change `api-version` to `2025-05-15-preview`
- **400 Missed model deployment**: you are hitting the wrong endpoint (not the agent endpoint)
- **404**: the agent name in the URL is wrong — check it matches exactly in AI Foundry → Agents
