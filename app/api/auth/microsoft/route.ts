import { NextResponse } from 'next/server'
import { ConfidentialClientApplication } from '@azure/msal-node'

export const dynamic = 'force-dynamic'

export async function GET() {
  const msalConfig = {
    auth: {
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
      authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
    },
  }

  const cca = new ConfidentialClientApplication(msalConfig)
  const authUrl = await cca.getAuthCodeUrl({
    scopes: ['https://ml.azure.com/user_impersonation', 'offline_access'],
    redirectUri: `${process.env.NEXTAUTH_URL}/api/auth/microsoft/callback`,
  })

  return NextResponse.redirect(authUrl)
}
