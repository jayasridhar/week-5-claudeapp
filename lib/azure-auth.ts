import { ClientSecretCredential, DefaultAzureCredential, type TokenCredential } from '@azure/identity'

const AZURE_SCOPE = 'https://ai.azure.com/.default'

let credential: TokenCredential | null = null

function getCredential() {
  if (credential) return credential

  const tenantId = process.env.AZURE_TENANT_ID
  const clientId = process.env.AZURE_CLIENT_ID
  const clientSecret = process.env.AZURE_CLIENT_SECRET

  credential = tenantId && clientId && clientSecret
    ? new ClientSecretCredential(tenantId, clientId, clientSecret)
    : new DefaultAzureCredential()

  return credential
}

export async function getAzureHeaders() {
  const apiKey = process.env.AZURE_API_KEY
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (apiKey) {
    headers['api-key'] = apiKey
  }

  const explicitAmlUserToken = process.env.AZURE_AML_USER_TOKEN
  if (explicitAmlUserToken) {
    headers['aml-user-token'] = explicitAmlUserToken
    return headers
  }

  try {
    const tokenResponse = await getCredential().getToken(AZURE_SCOPE)
    if (!tokenResponse?.token) {
      throw new Error('Azure did not return an access token.')
    }

    if (apiKey) {
      headers['aml-user-token'] = tokenResponse.token
    } else {
      headers.Authorization = `Bearer ${tokenResponse.token}`
    }

    return headers
  } catch {
    if (apiKey) {
      return headers
    }

    throw new Error(
      'Azure authentication is not configured. Add AZURE_API_KEY to .env, or set AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET for an Azure app registration. For local developer login, install Azure CLI and run az login.'
    )
  }
}
