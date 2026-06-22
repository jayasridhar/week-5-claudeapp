# DocAssist — Legal Contract Review App
## Blueprint & Technical Plan

**Version:** 1.0  
**Date:** June 2026  
**Status:** Implementation complete

---

## 1. App Overview

DocAssist is an AI-powered document analysis web application. Users upload a PDF or DOCX contract, ask questions in plain English, and receive answers from an Azure AI agent that is grounded strictly in the uploaded document. Every conversation is persisted in Supabase so users can return to past sessions and continue at any time.

### User journey (end to end)

```
Landing page (/) 
  → Sign up (/signup) or Log in (/login)
  → Dashboard (/dashboard) — KPI cards + recent session list
  → New chat → /dashboard/chat/[sessionId]
      Attach PDF or DOCX
      Type a question → Azure AI agent answers
      Feedback form appears after every assistant response
  → Return to dashboard, open any past session, continue
```

### Three-panel layout (dashboard + chat)

```
┌───────────────────────────────────────────────────────────┐
│  Sidebar (256px)  │  Center (flex-1)  │  Right (304px)   │
│  bg-subtle        │  bg-base          │  bg-subtle        │
│  - Logo           │  - KPI cards      │  - Doc preview    │
│  - New chat btn   │  - Chat messages  │  - Exec steps     │
│  - Session list   │  - Composer       │                   │
│  - User / Logout  │                   │                   │
└───────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | API routes + React in one repo |
| Language | TypeScript | Type safety across front and back |
| Styling | Tailwind CSS + CSS custom properties | Design system tokens (`an-*`) |
| Database | Supabase (PostgreSQL) | Easy setup, real-time JS SDK |
| Auth | Custom `users` table + bcryptjs | Full control — no Supabase Auth |
| AI | Azure AI Foundry Agent | Enterprise compliance, large context window |
| Azure auth | `@azure/msal-node` OAuth 2.0 | Bearer token required by Azure Agents API |
| PDF parsing | pdfjs-dist v4 | Client-side, file never leaves browser |
| DOCX parsing | mammoth | Client-side |
| Icons | Lucide React | Stroke-only, 1.5px weight |
| Hosting | Vercel | Zero-config deploy |

---

## 3. Page & Route Map

### Pages

| Route | Auth | Description |
|---|---|---|
| `/` | Public | Landing page — hero, features, pricing, auth CTAs |
| `/signup` | Public | Email + password registration; redirects to `/dashboard` |
| `/login` | Public | Email + password login; redirects to `/dashboard` |
| `/dashboard` | Protected | KPI card grid + recent sessions list |
| `/dashboard/chat/[sessionId]` | Protected | Full chat interface for a specific session |

### API Routes

| Method + Route | Description |
|---|---|
| `POST /api/auth/signup` | Hash password with bcrypt (10 rounds), insert into `users` table |
| `POST /api/auth/login` | Query `users` by email, compare bcrypt hash, return `userId` + `userEmail` |
| `GET /api/auth/microsoft` | Generate Microsoft OAuth URL via MSAL, redirect user |
| `GET /api/auth/microsoft/callback` | Exchange code for Bearer token, store in HTTP-only cookie `azure_token` |
| `POST /api/chat` | Create Azure thread → add message → run agent → poll → return response |
| `GET /api/sessions?userId=` | List all sessions for user, ordered pinned first then newest |
| `POST /api/sessions` | Create new session, return session row |
| `GET /api/sessions/[id]` | Get single session |
| `PATCH /api/sessions/[id]` | Update title, pinned, or status |
| `DELETE /api/sessions/[id]` | Delete session (cascades to messages + feedback) |
| `GET /api/messages?sessionId=` | Get all messages for session, ordered chronologically |
| `POST /api/messages` | Save a single message (user or assistant) |
| `POST /api/feedback` | Save star rating + optional comment |
| `GET /api/dashboard/stats?userId=` | Return 8 KPI aggregates |

---

## 4. Database Schema

Run all of the following SQL in the **Supabase SQL editor** (Dashboard → SQL Editor → New query).

```sql
-- ============================================================
-- USERS
-- Custom auth table — no Supabase Auth
-- ============================================================
CREATE TABLE users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        UNIQUE NOT NULL,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SESSIONS
-- One row per chat session (= one document analysis thread)
-- ============================================================
CREATE TABLE sessions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL DEFAULT 'New session',
  status     TEXT        NOT NULL DEFAULT 'idle'
               CHECK (status IN ('idle', 'processing', 'completed', 'error')),
  pinned     BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- MESSAGES
-- Every user question and assistant response
-- ============================================================
CREATE TABLE messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- FEEDBACK
-- Star rating (1–5) + optional comment per assistant message
-- ============================================================
CREATE TABLE feedback (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  rating     INTEGER     NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment    TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEXES — cover the most common queries
-- ============================================================
CREATE INDEX sessions_user_id_idx    ON sessions(user_id);
CREATE INDEX sessions_updated_at_idx ON sessions(updated_at DESC);
CREATE INDEX messages_session_id_idx ON messages(session_id);
CREATE INDEX messages_created_at_idx ON messages(created_at);
CREATE INDEX feedback_user_id_idx    ON feedback(user_id);
CREATE INDEX feedback_session_id_idx ON feedback(session_id);

-- ============================================================
-- TRIGGER — auto-update sessions.updated_at on edit
-- ============================================================
CREATE OR REPLACE FUNCTION update_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sessions_updated_at_trigger
BEFORE UPDATE ON sessions
FOR EACH ROW EXECUTE FUNCTION update_session_updated_at();

-- ============================================================
-- TRIGGER — bump sessions.updated_at when a message is added
-- Keeps the sidebar "last active" sort accurate automatically
-- ============================================================
CREATE OR REPLACE FUNCTION bump_session_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE sessions SET updated_at = now() WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_bump_session_trigger
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION bump_session_on_message();
```

---

## 5. File Structure

```
week-5-claudeapp/
├── .env.local                  ← credentials (never commit)
├── next.config.mjs
├── tailwind.config.ts          ← an-* color tokens + font families
├── postcss.config.mjs
├── tsconfig.json
├── blueprint/
│   └── app-plan.md             ← this file
├── public/
│   └── pdf.worker.min.mjs      ← copy from node_modules after npm install
├── app/
│   ├── globals.css             ← CSS vars (dark default / light override), fonts, animations
│   ├── layout.tsx              ← root layout
│   ├── page.tsx                ← landing page
│   ├── signup/page.tsx
│   ├── login/page.tsx
│   ├── dashboard/
│   │   ├── layout.tsx          ← 3-panel shell + DashboardContext provider
│   │   ├── page.tsx            ← KPI cards + recent sessions
│   │   └── chat/[sessionId]/
│   │       └── page.tsx        ← chat interface
│   └── api/
│       ├── auth/signup/route.ts
│       ├── auth/login/route.ts
│       ├── auth/microsoft/route.ts
│       ├── auth/microsoft/callback/route.ts
│       ├── chat/route.ts       ← Azure AI Foundry agent integration
│       ├── sessions/route.ts
│       ├── sessions/[id]/route.ts
│       ├── messages/route.ts
│       ├── feedback/route.ts
│       └── dashboard/stats/route.ts
├── components/
│   ├── Sidebar.tsx             ← session list, search, pin/rename/delete, logout
│   ├── RightPanel.tsx          ← PDF iframe / DOCX text preview + execution steps
│   ├── ExecutionSteps.tsx      ← 5-step progress tracker
│   ├── ChatComposer.tsx        ← textarea + file upload + send
│   ├── FileUpload.tsx          ← pdfjs-dist + mammoth, 10 MB limit
│   ├── MessageBubble.tsx       ← user (right, coral) + assistant (left, no bubble)
│   ├── FeedbackForm.tsx        ← 5-star + comment
│   ├── SessionItem.tsx         ← 36px list row with context menu
│   └── KPICard.tsx             ← metric card with skeleton loading
└── lib/
    ├── supabase.ts             ← Supabase client singleton
    ├── db.ts                   ← 10 typed DB helpers + getDashboardStats
    └── DashboardContext.tsx    ← shared state across 3-panel layout
```

---

## 6. Key Implementation Decisions

| Decision | Detail |
|---|---|
| **Auth strategy** | Custom `users` table + bcryptjs 10 rounds. `userId` + `userEmail` stored in `localStorage`. No Supabase Auth. |
| **Auth guard** | Every protected page reads `localStorage.userId` on mount; redirects to `/login` if missing. |
| **Azure auth** | OAuth 2.0 Bearer token (never API key). Stored in HTTP-only cookie `azure_token` (7-day expiry). Read server-side in `/api/chat`. |
| **Azure calls** | 100% server-side in `/api/chat`. Never called from the browser. API version must be `2025-05-01` exactly. |
| **File parsing** | Client-side only. The raw file never leaves the browser. Only extracted plain text is sent to `/api/chat`. |
| **File storage** | No server persistence. Contract text lives in `DashboardContext.filePreview.extractedText` (component state). |
| **Shared state** | `DashboardContext` in `app/dashboard/layout.tsx` owns `sessions`, `filePreview`, `executionSteps`, `isProcessing`. Avoids prop drilling across the 3-panel shell. |
| **Session title** | Auto-generated from first 55 chars of the first user message + `…`. Only applied when title is still `'New session'`. |
| **PDF worker** | pdfjs-dist v4 requires `pdf.worker.min.mjs` served from `/public/`. Must be copied manually after `npm install`. |
| **Design mode** | Dark mode (default `:root` CSS vars) for dashboard and chat. Light mode (`[data-theme="light"]`) for `/signup` and `/login` pages only. |

---

## 7. Azure AI Chat Flow (`POST /api/chat`)

```
1. Read azure_token from HTTP-only cookie → 401 if missing
2. POST {ENDPOINT}/threads?api-version=2025-05-01  → threadId
3. POST {ENDPOINT}/threads/{threadId}/messages
   body: { role: 'user', content: SYSTEM_PROMPT + contractText + userMessage }
4. POST {ENDPOINT}/threads/{threadId}/runs
   body: { assistant_id: AZURE_AGENT_ID }
5. Poll GET {ENDPOINT}/threads/{threadId}/runs/{runId} every 2s
   → stop when status = 'completed' | 'failed' | 'cancelled'
   → 408 timeout after 45s
6. GET {ENDPOINT}/threads/{threadId}/messages
   → extract last assistant message text content
7. Return { content: assistantText }
```

**System prompt (injected with every request):**
> You are an AI assistant. Answer questions based solely on the document text provided. Always cite the specific section or part you are referencing. If the answer cannot be found in the provided text, say: "I cannot find this in the document." Do not speculate beyond what the document contains.

---

## 8. Environment Variables

Fill all values in `.env.local` before running the app. Never commit this file.

```env
# Supabase — Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhb...

# Azure App Registration — Azure Portal → App registrations → your app
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_SECRET=your-client-secret-value
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Azure AI Foundry — your project → Agents → agent detail
AZURE_AGENT_ENDPOINT_URL=https://<name>.services.ai.azure.com/api/projects/<project>
AZURE_AGENT_ID=asst_xxxxxxxxxxxxxxxxxxxx

# App base URL
NEXTAUTH_URL=http://localhost:3000
```

---

## 9. Azure One-Time Portal Setup

1. Go to **Azure Portal → Azure Active Directory → App registrations → New registration**
2. Add redirect URI: `http://localhost:3000/api/auth/microsoft/callback`
3. Add API permission: **Azure Machine Learning → Delegated → `user_impersonation`**
4. Grant admin consent for the permission
5. Create a client secret under **Certificates & secrets → New client secret**
6. Copy: Application (client) ID, Directory (tenant) ID, secret value → `.env.local`
7. From **Azure AI Foundry → your project → Overview**: copy the endpoint URL → `AZURE_AGENT_ENDPOINT_URL`
8. From **Azure AI Foundry → Agents → your agent**: copy the `asst_xxx` ID → `AZURE_AGENT_ID`

---

## 10. Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Copy pdfjs worker to public (required for PDF parsing in browser)
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/

# 3. Fill in credentials
#    Edit .env.local — all 7 values required before the app will work

# 4. Set up Supabase
#    Go to your Supabase project → SQL Editor → New query
#    Paste and run the complete SQL from Section 4 above

# 5. Start development server
npm run dev

# App is live at http://localhost:3000
```

---

## 11. Verification Checklist

Run through each flow after starting the app to confirm everything works end to end.

| Flow | What to verify |
|---|---|
| **Signup** | New row appears in Supabase `users` table; page redirects to `/dashboard` |
| **Login** | `userId` and `userEmail` stored in localStorage; wrong creds show generic error |
| **Auth guard** | Navigate to `/dashboard` while logged out → redirected to `/login` |
| **New chat** | New row in Supabase `sessions` table; URL changes to `/dashboard/chat/[id]` |
| **File upload — PDF** | Right panel shows iframe with PDF; no blank/empty extraction |
| **File upload — DOCX** | Right panel shows plain text in `<pre>` block |
| **File validation** | File > 10 MB → error message; `.txt` file → error message |
| **Send message** | User + assistant rows in `messages` table; session `status` = `completed` |
| **Auto-title** | Session title in sidebar changes to first 55 chars of first message |
| **Azure 401** | Without connecting Microsoft → chat shows "Not connected to Azure" |
| **Execution steps** | Right panel steps animate idle → active → done as message sends |
| **Feedback** | 5-star submit → row in `feedback` table; form shows "Thanks for your feedback" |
| **Session rename** | Inline edit in sidebar → title updated in Supabase |
| **Pin** | Pin from context menu → session moves to "Pinned" section at top |
| **Delete** | Confirm delete → session removed from sidebar; cascade deletes messages + feedback |
| **Logout** | Sidebar logout → localStorage cleared → redirected to `/login` |
| **Design** | Auth pages (`/signup`, `/login`) use light background; dashboard uses dark background |
