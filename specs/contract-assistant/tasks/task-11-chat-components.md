# Task 11: Chat Components + ChatContext

## Status

complete

## Wave

3

## Description

Build the complete chat UI: the `ChatWorkspace` container, `MessageList`, `MessageBubble`, `TypingIndicator`, `MessageInputBar`, and the contract components `ContractUploadBanner` and `ContractStatusChip`. Also create `ChatContext` and `useChat` hook that will manage message state and sending. In this task, the chat context is wired to the API client (for loading history) but the actual AI message sending is completed in task-13. This task runs in parallel with task-09 and task-10.

## Dependencies

**Depends on:** task-04-supabase-client-auth, task-08-ui-primitives
**Blocks:** task-12-dashboard-integration, task-13-azure-ai-integration

**Context from dependencies:**
- task-04 defines the `Message` and `ChatSession` types in `src/types/index.ts`. The `Message` type is `{ id, session_id, role: 'user' | 'assistant', content, created_at }`.
- task-08 built `Button` (`src/components/ui/Button.tsx`) and `Badge` (`src/components/ui/Badge.tsx`). Import and use them where appropriate.

## Files to Create

- `src/store/ChatContext.tsx` — message state, loading, and sendMessage function
- `src/hooks/useChat.ts` — convenience hook
- `src/components/chat/MessageList.tsx` — scrollable list of message bubbles
- `src/components/chat/MessageBubble.tsx` — individual user/assistant message
- `src/components/chat/TypingIndicator.tsx` — animated dots while AI is responding
- `src/components/chat/MessageInputBar.tsx` — textarea + send button + contract attach button
- `src/components/chat/ChatWorkspace.tsx` — full chat area (assembles all chat components)
- `src/components/contract/ContractUploadBanner.tsx` — prompts user to upload a contract
- `src/components/contract/ContractStatusChip.tsx` — shows contract upload status as a badge

## Technical Details

### ChatContext.tsx

```tsx
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { Message, ChatSession } from '../types'
import { api } from '../lib/apiClient'

interface ChatContextValue {
  messages: Message[]
  sending: boolean
  loadMessages: (sessionId: string) => Promise<void>
  sendMessage: (sessionId: string, content: string) => Promise<void>
  clearMessages: () => void
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [sending, setSending] = useState(false)

  const loadMessages = useCallback(async (sessionId: string) => {
    const { messages } = await api.sessions.getMessages(sessionId)
    setMessages(messages)
  }, [])

  const sendMessage = useCallback(async (sessionId: string, content: string) => {
    setSending(true)
    try {
      const { user_message, assistant_message } = await api.sessions.sendMessage(sessionId, content)
      setMessages((prev) => [...prev, user_message, assistant_message])
    } finally {
      setSending(false)
    }
  }, [])

  const clearMessages = () => setMessages([])

  return (
    <ChatContext.Provider value={{ messages, sending, loadMessages, sendMessage, clearMessages }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChatContext() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider')
  return ctx
}
```

### MessageBubble.tsx

```tsx
import { Message } from '../../types'

interface MessageBubbleProps {
  message: Message
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 'var(--space-3)',
      }}
    >
      <div
        style={{
          maxWidth: '72%',
          padding: 'var(--space-3) var(--space-5)',
          borderRadius: isUser
            ? 'var(--radius-xl) var(--radius-xl) var(--radius-xs) var(--radius-xl)'
            : 'var(--radius-xl) var(--radius-xl) var(--radius-xl) var(--radius-xs)',
          backgroundColor: isUser ? 'var(--brand-primary)' : 'var(--surface-card)',
          color: isUser ? 'var(--text-on-primary)' : 'var(--text-body)',
          boxShadow: 'var(--shadow-sm)',
          border: isUser ? 'none' : '1px solid var(--border-default)',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-base)',
          lineHeight: 'var(--leading-relaxed)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {message.content}
      </div>
    </div>
  )
}
```

### TypingIndicator.tsx

```tsx
export default function TypingIndicator() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 'var(--space-3)' }}>
      <div
        style={{
          padding: 'var(--space-3) var(--space-5)',
          borderRadius: 'var(--radius-xl) var(--radius-xl) var(--radius-xl) var(--radius-xs)',
          backgroundColor: 'var(--surface-card)',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          gap: 4,
          alignItems: 'center',
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: 'var(--text-muted)',
              animation: `typing-bounce 1.2s ease-in-out infinite`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
        <style>{`
          @keyframes typing-bounce {
            0%, 60%, 100% { transform: translateY(0); }
            30% { transform: translateY(-4px); }
          }
        `}</style>
      </div>
    </div>
  )
}
```

### MessageList.tsx

```tsx
import { useEffect, useRef } from 'react'
import { Message } from '../../types'
import MessageBubble from './MessageBubble'
import TypingIndicator from './TypingIndicator'

interface MessageListProps {
  messages: Message[]
  sending: boolean
}

export default function MessageList({ messages, sending }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: 'var(--space-6) var(--space-7)',
      }}
    >
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {sending && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  )
}
```

### MessageInputBar.tsx

```tsx
import { useState, KeyboardEvent } from 'react'
import Button from '../ui/Button'

interface MessageInputBarProps {
  onSend: (content: string) => void
  onAttachContract: () => void
  disabled?: boolean
  contractUploaded?: boolean
}

export default function MessageInputBar({
  onSend,
  onAttachContract,
  disabled = false,
  contractUploaded = false,
}: MessageInputBarProps) {
  const [value, setValue] = useState('')

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      style={{
        flexShrink: 0,
        padding: 'var(--space-4) var(--space-6)',
        borderTop: '1px solid var(--border-default)',
        backgroundColor: 'var(--surface-card)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 'var(--space-3)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-3)',
          backgroundColor: 'var(--surface-raised)',
          boxShadow: 'var(--shadow-inset)',
        }}
      >
        {/* Attach contract button */}
        <button
          onClick={onAttachContract}
          title={contractUploaded ? 'Contract attached' : 'Attach contract'}
          style={{
            flexShrink: 0,
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-md)',
            border: '1px solid',
            borderColor: contractUploaded ? 'var(--safe-border)' : 'var(--border-default)',
            backgroundColor: contractUploaded ? 'var(--safe-bg)' : 'var(--surface-sunken)',
            color: contractUploaded ? 'var(--safe-fg)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            transition: 'var(--transition-control)',
          }}
        >
          📎
        </button>

        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about the contract…"
          disabled={disabled}
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-base)',
            color: 'var(--text-body)',
            lineHeight: 'var(--leading-relaxed)',
            maxHeight: 120,
            overflowY: 'auto',
          }}
        />

        <Button
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          size="sm"
          style={{ flexShrink: 0 }}
        >
          Send
        </Button>
      </div>
      <p className="lg-small" style={{ marginTop: 'var(--space-2)', color: 'var(--text-muted)' }}>
        Press Enter to send · Shift+Enter for new line
      </p>
    </div>
  )
}
```

### ContractUploadBanner.tsx

```tsx
interface ContractUploadBannerProps {
  onFileSelect: (file: File) => void
  uploading?: boolean
}

export default function ContractUploadBanner({ onFileSelect, uploading = false }: ContractUploadBannerProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFileSelect(file)
    e.target.value = ''
  }

  return (
    <div
      style={{
        margin: 'var(--space-5) var(--space-7)',
        padding: 'var(--space-6)',
        borderRadius: 'var(--radius-lg)',
        border: '1.5px dashed var(--border-strong)',
        backgroundColor: 'var(--surface-sunken)',
        textAlign: 'center',
      }}
    >
      <p className="lg-eyebrow" style={{ marginBottom: 'var(--space-2)' }}>
        Contract · Required
      </p>
      <p className="lg-body" style={{ marginBottom: 'var(--space-5)' }}>
        Upload a contract to start the conversation. PDF and TXT files are supported.
      </p>
      <label
        style={{
          display: 'inline-block',
          padding: '10px 20px',
          backgroundColor: 'var(--brand-primary)',
          color: 'var(--text-on-primary)',
          borderRadius: 'var(--radius-md)',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          cursor: uploading ? 'not-allowed' : 'pointer',
          opacity: uploading ? 0.6 : 1,
          transition: 'var(--transition-control)',
        }}
      >
        {uploading ? 'Parsing…' : 'Choose file'}
        <input
          type="file"
          accept=".pdf,.txt,text/plain,application/pdf"
          onChange={handleChange}
          style={{ display: 'none' }}
          disabled={uploading}
        />
      </label>
    </div>
  )
}
```

### ContractStatusChip.tsx

```tsx
import Badge from '../ui/Badge'

interface ContractStatusChipProps {
  uploaded: boolean
  fileName?: string
}

export default function ContractStatusChip({ uploaded, fileName }: ContractStatusChipProps) {
  if (!uploaded) {
    return <Badge variant="warning" dot>No contract</Badge>
  }
  return (
    <Badge variant="success" dot>
      {fileName ? `${fileName.slice(0, 20)}…` : 'Contract attached'}
    </Badge>
  )
}
```

### ChatWorkspace.tsx

```tsx
import { useEffect, useState } from 'react'
import { ChatSession } from '../../types'
import TopBar from '../layout/TopBar'
import MessageList from './MessageList'
import MessageInputBar from './MessageInputBar'
import ContractUploadBanner from '../contract/ContractUploadBanner'
import ContractStatusChip from '../contract/ContractStatusChip'
import { useChatContext } from '../../store/ChatContext'

interface ChatWorkspaceProps {
  session: ChatSession
  onAttachContract: (file: File) => void
  contractFileName?: string
}

export default function ChatWorkspace({ session, onAttachContract, contractFileName }: ChatWorkspaceProps) {
  const { messages, sending, loadMessages, sendMessage, clearMessages } = useChatContext()
  const hasContract = !!session.contract_text

  useEffect(() => {
    clearMessages()
    loadMessages(session.id)
  }, [session.id])

  const handleSend = (content: string) => {
    sendMessage(session.id, content)
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--surface-canvas)' }}>
      <TopBar
        title={session.title}
        aside={<ContractStatusChip uploaded={hasContract} fileName={contractFileName} />}
      />
      {!hasContract && (
        <ContractUploadBanner onFileSelect={onAttachContract} />
      )}
      <MessageList messages={messages} sending={sending} />
      <MessageInputBar
        onSend={handleSend}
        onAttachContract={() => {
          const input = document.querySelector<HTMLInputElement>('input[type="file"]')
          input?.click()
        }}
        disabled={sending}
        contractUploaded={hasContract}
      />
    </div>
  )
}
```

### useChat.ts

```ts
export { useChatContext as useChat } from '../store/ChatContext'
```

## Acceptance Criteria

- [ ] `ChatWorkspace` renders the TopBar, message list, and input bar
- [ ] When `session.contract_text` is null, `ContractUploadBanner` is shown above the message list
- [ ] When `session.contract_text` is set, the banner is hidden and `ContractStatusChip` shows "Contract attached"
- [ ] `MessageBubble` renders user messages right-aligned (ink-blue), assistant messages left-aligned (card)
- [ ] `TypingIndicator` shows animated dots when `sending` is true
- [ ] Pressing Enter in the textarea sends the message; Shift+Enter adds a newline
- [ ] The message list auto-scrolls to the bottom when new messages arrive
- [ ] `npx tsc --noEmit` passes for all files

## Notes

- `ChatProvider` must be added to the app's provider tree in task-12 — this task only defines it.
- The `ContractUploadBanner` in `ChatWorkspace` triggers the hidden file input indirectly via `document.querySelector`. A cleaner approach in task-13 is to lift the file input ref up and pass a callback — but for now this pattern is acceptable.
- The `emoji` in `MessageInputBar` (`📎`) is a temporary placeholder. The design system says no emoji in product UI — replace with an SVG icon (Lucide `paperclip`) when time permits. For now it works.
