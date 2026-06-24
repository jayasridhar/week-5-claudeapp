import { NextRequest, NextResponse } from 'next/server'
import { ConfidentialClientApplication } from '@azure/msal-node'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=oauth_failed`)
  }

  const msalConfig = {
    auth: {
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
      authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
    },
  }

  try {
    const cca = new ConfidentialClientApplication(msalConfig)
    const result = await cca.acquireTokenByCode({
      code,
      scopes: ['https://ml.azure.com/user_impersonation', 'offline_access'],
      redirectUri: `${process.env.NEXTAUTH_URL}/api/auth/microsoft/callback`,
    })

    const token = result?.accessToken
    if (!token) throw new Error('No access token returned')

    const res = NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard`)
    res.cookies.set('azure_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 7 * 24, // 7 days
      path: '/',
    })
    return res
  } catch {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=token_exchange_failed`)
  }
}
