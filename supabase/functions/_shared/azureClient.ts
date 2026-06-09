export async function createAzureThread(): Promise<string> {
  return `stub-thread-${Date.now()}`
}

export async function sendToAzureAgent(
  _threadId: string,
  _userMessage: string,
  _contractText: string | null
): Promise<string> {
  return 'I have received your message. Azure AI integration will be wired in task-13.'
}
