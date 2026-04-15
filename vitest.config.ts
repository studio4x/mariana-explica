import path from "path"
import { fileURLToPath } from "url"
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    globals: true,
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**"],
  },
})
