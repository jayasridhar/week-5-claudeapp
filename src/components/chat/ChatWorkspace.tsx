import { useEffect } from 'react'
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
  }, [session.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
        onSend={(content) => sendMessage(session.id, content)}
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
