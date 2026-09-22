/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['mammoth', '@azure/msal-node'],
    outputFileTracingIncludes: {
      '/api/normalize-financials': ['./scripts/financial_normalizer.py'],
    },
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false
    return config
  },
}

export default nextConfig
