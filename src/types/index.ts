export interface ChatSession {
  id: string
  user_id: string
  title: string
  contract_text: string | null
  azure_thread_id: string | null
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface CreateSessionResponse {
  session: ChatSession
}

export interface SendMessagePayload {
  session_id: string
  content: string
}

export interface SendMessageResponse {
  user_message: Message
  assistant_message: Message
}

export interface UpdateSessionPayload {
  title?: string
  contract_text?: string
}
