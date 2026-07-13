# Azure AI Agent — Auth & Endpoint Reference

---

## What This Integration Does

This app talks to an **Azure AI Agent** (not OpenAI). The agent lives in Azure AI Foundry and
handles contract analysis via a managed thread. All calls go through a Next.js API route —
never from the client.

---

## CRITICAL: Auth Type

The Agents threads endpoint (`*.services.ai.azure.com/api/projects/*/threads`) requires an
**Azure AD Bearer token**. API keys will NOT work — you will get an identity permissions error.

- Use OAuth 2.0 (`@azure/msal-node`) for production / any user-facing flow
- Use `az login` + `DefaultAzureCredential` for local-only developer use only

---

## API Version

Always use `2025-05-01`. All other versions return `BadRequest: API version not supported`.

---

## Credentials the User Must Provide

Collect these five values from the user before the app can call Azure AI:

| Env Var | Where to find it | Required |
|---|---|---|
| `AZURE_CLIENT_ID` | Azure Portal → App registrations → your app → Application (client) ID | Yes |
| `AZURE_CLIENT_SECRET` | Azure Portal → App registrations → your app → Certificates & secrets → client secret value | Yes |
| `AZURE_TENANT_ID` | Azure Portal → App registrations → your app → Directory (tenant) ID | Yes |
| `AZURE_AGENT_ENDPOINT_URL` | Azure AI Foundry → your project → Overview → endpoint URL (format: `https://<name>.services.ai.azure.com/api/projects/<project>`) | Yes |
| `AZURE_AGENT_ID` | Azure AI Foundry → your project → Agents → click the agent → copy the `asst_xxx` ID | Yes |

> **Note on `AZURE_AGENT_ID`:** Do NOT copy the agent display name. It must be the `asst_xxx`
> format ID. Passing a display name returns `Invalid 'assistant_id': expected 'asst'`.

---

## One-Time Azure Setup (App Registration)

1. Go to Azure Portal → Azure Active Directory → App registrations → New registration
2. Set redirect URIs:
   - `http://localhost:3000/api/auth/microsoft/callback` (dev)
   - `https://yourdomain.com/api/auth/microsoft/callback` (production)
3. Add API permission: Azure Machine Learning → Delegated → `user_impersonation`
4. Grant admin consent for the permission
5. Create a client secret (Certificates & secrets → New client secret)
6. Copy: Application (client) ID, Directory (tenant) ID, and the secret value

---

## Environment Variables

```env
# Azure App Registration
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_TENANT_ID=

# Azure AI Agent
AZURE_AGENT_ENDPOINT_URL=
AZURE_AGENT_ID=

# Auth callback
NEXTAUTH_URL=http://localhost:3000
```

Copy `.env.local.example` to `.env.local` and fill in all values before starting the app.

---

## OAuth Flow (Production)

### Step 1 — User clicks "Connect with Microsoft"
The button links to `/api/auth/microsoft`, which uses `ConfidentialClientApplication`
from `@azure/msal-node` to generate a Microsoft login URL and redirects the user.

Required scopes:
```
https://ml.azure.com/user_impersonation
offline_access
```

### Step 2 — Microsoft redirects back
`/api/auth/microsoft/callback` receives the `code` query param, calls `acquireTokenByCode`,
and stores the access token in an HTTP-only cookie. Redirect user to dashboard.

### Step 3 — Chat route uses the token
Read the access token from the HTTP-only cookie. Pass it as `Authorization: Bearer <token>`
on all Azure AI API calls. Return 401 if the cookie is missing.

### Step 4 — Token refresh
Access tokens expire after ~1 hour. Call `acquireTokenSilent` to refresh silently.
If that fails, redirect user to `/api/auth/microsoft` to reconnect.

---

## API Routes to Implement

### `GET /api/auth/microsoft`
- Generate Microsoft login URL via `ConfidentialClientApplication`
- Redirect user to it

### `GET /api/auth/microsoft/callback`
- Extract `code` from query string
- Call `acquireTokenByCode` with scopes and redirect URI
- Store access token in HTTP-only cookie
- Redirect to `/dashboard`

### `POST /api/chat`
- Read Bearer token from HTTP-only cookie — return 401 if missing
- Read `contractText` and `userMessage` from request body
- Create a thread: `POST {AZURE_AGENT_ENDPOINT_URL}/threads?api-version=2025-05-01`
- Add a message to the thread (include contractText as context)
- Run the thread against the agent: use `AZURE_AGENT_ID`
- Poll the run until status is `completed` or `failed`
- Retrieve and return the assistant message

---

## Using the Token

```typescript
const token = cookies().get('azure_token')?.value
if (!token) return Response.json({ error: 'Not connected' }, { status: 401 })

const response = await fetch(`${process.env.AZURE_AGENT_ENDPOINT_URL}/threads?api-version=2025-05-01`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
})
```

---

## Package

```bash
npm install @azure/msal-node
```

Do NOT install `@azure/openai` — this integration uses the Azure AI Foundry Agents REST API
directly, not the OpenAI SDK.

---

## Error Diagnosis

| Error | Cause | Fix |
|---|---|---|
| `Identity does not have permissions` | Using API key instead of Bearer token | Use OAuth token, not API key |
| `BadRequest: API version not supported` | Wrong API version | Use `2025-05-01` exactly |
| `Invalid 'assistant_id': expected 'asst'` | Passing agent display name | Use the `asst_xxx` ID from Foundry |
| `Not connected` / 401 on chat route | Cookie missing or expired | Redirect user to `/api/auth/microsoft` |
| `403` from Azure | User lacks Azure AI Agent Operator role | Assign role in Azure AI Foundry project |

---

## What NOT to Do

- Do not use an API key for the Agents endpoint
- Do not call Azure from the client side
- Do not store tokens in localStorage — use HTTP-only cookies
- Do not use `@azure/openai` package for the Agents API
- Do not pass the agent display name as `assistant_id`
- Do not hardcode any credentials
