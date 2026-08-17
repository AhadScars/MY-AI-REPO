import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function ensureWasmPlugin() {
  const files = ['sql-wasm-browser.wasm', 'sql-wasm.wasm']
  return {
    name: 'ensure-sqljs-wasm',
    buildStart() {
      const destDir = resolve(__dirname, 'public')
      if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true })
      for (const file of files) {
        const src = resolve(__dirname, 'node_modules/sql.js/dist', file)
        const dest = resolve(destDir, file)
        if (existsSync(src)) copyFileSync(src, dest)
        else console.warn(`[sql.js] missing ${file}`)
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), ensureWasmPlugin()],
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    exclude: ['sql.js'],
  },
  server: { port: 5177 },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
  },
})
