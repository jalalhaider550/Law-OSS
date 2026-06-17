/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack(config, { isServer }) {
    if (!isServer) {
      // Prevent Next.js from bundling Node-only mammoth modules on the client
      config.resolve.alias = {
        ...config.resolve.alias,
        mammoth: require.resolve('mammoth/mammoth.browser.min.js'),
      }
    }
    return config
  },
}
module.exports = nextConfig
