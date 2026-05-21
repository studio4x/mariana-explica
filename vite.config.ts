import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packageJsonPath = path.resolve(__dirname, "package.json")

// https://vite.dev/config/
const base = process.env.VITE_BASE_URL || "/"
const packageVersion = (() => {
  if (process.env.VITE_APP_VERSION?.trim()) {
    return process.env.VITE_APP_VERSION.trim()
  }

  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string }
    const version = String(parsed.version ?? "").trim()
    return version || "0.0.0"
  } catch {
    return "0.0.0"
  }
})()

const commitHash = (() => {
  if (process.env.VERCEL_GIT_COMMIT_SHA?.trim()) {
    return process.env.VERCEL_GIT_COMMIT_SHA.trim()
  }

  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim()
  } catch {
    return process.env.VITE_BUILD_VERSION || "local"
  }
})()

const commitShort = commitHash.slice(0, 7)
const buildVersion = commitShort

const deployId = (() => {
  const raw =
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.VERCEL_URL ||
    process.env.VITE_DEPLOYMENT_ID ||
    ""

  const normalized = String(raw).trim()
  if (!normalized) return "local"
  return normalized
})()

const deployShort = deployId.replace(/^dpl_/, "").slice(0, 10) || "local"
const buildMetadata = {
  version: packageVersion,
  commitHash,
  commitShort,
  deployId,
  deployShort,
}

function resolveVendorChunk(id: string) {
  if (!id.includes("node_modules")) {
    return undefined
  }

  if (id.includes("node_modules/grapesjs")) {
    return "vendor-editor-grapesjs"
  }

  if (
    id.includes("node_modules/@tiptap") ||
    id.includes("node_modules/prosemirror")
  ) {
    return "vendor-editor-tiptap"
  }

  if (id.includes("node_modules/@supabase")) {
    return "vendor-supabase"
  }

  if (
    id.includes("node_modules/react/") ||
    id.includes("node_modules/react-dom/") ||
    id.includes("node_modules/react-router/") ||
    id.includes("node_modules/react-router-dom/") ||
    id.includes("node_modules/@tanstack/react-query")
  ) {
    return "vendor-react"
  }

  if (
    id.includes("node_modules/@radix-ui/") ||
    id.includes("node_modules/lucide-react/") ||
    id.includes("node_modules/clsx/") ||
    id.includes("node_modules/class-variance-authority/") ||
    id.includes("node_modules/tailwind-merge/")
  ) {
    return "vendor-ui"
  }

  return "vendor-misc"
}

export default defineConfig({
  base,
  define: {
    __BUILD_VERSION__: JSON.stringify(buildVersion),
    __BUILD_METADATA__: JSON.stringify(buildMetadata),
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          return resolveVendorChunk(id)
        },
      },
    },
  },
})
