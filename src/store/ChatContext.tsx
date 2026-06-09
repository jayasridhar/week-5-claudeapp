import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { Message } from '../types'
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
