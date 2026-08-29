const { PHASE_DEVELOPMENT_SERVER } = require("next/constants")

module.exports = (phase) => {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER

  /** @type {import('next').NextConfig} */
  const nextConfig = {
    distDir: isDev ? ".next-dev" : ".next",
    allowedDevOrigins: ["127.0.0.1", "localhost"],
    images: {
      domains: ["avatars.githubusercontent.com"],
    },
    serverExternalPackages: ["@whiskeysockets/baileys", "@hapi/boom"],
  }

  return nextConfig
}
