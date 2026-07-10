import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
const base = process.env.VITE_BASE_URL || "/"
const buildCommit = (() => {
  const explicitCommit = process.env.VERCEL_GIT_COMMIT_SHA?.trim()
  if (explicitCommit) {
    return explicitCommit.slice(0, 7)
  }

  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim()
  } catch {
    return ""
  }
})()

export default defineConfig({
  base,
  define: {
    __BUILD_COMMIT__: JSON.stringify(buildCommit),
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
