import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
const BACKEND = process.env.VITE_BACKEND_ORIGIN ?? 'http://localhost:8080'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  // Dev'de istekler Vite uzerinden backend'e vekillenir. Prod'da nginx ayni
  // isi yapar; boylece her iki ortamda da tek origin var ve CORS ile cookie
  // davranisi ayni kalir.
  server: {
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
      '/ws': { target: BACKEND, ws: true, changeOrigin: true },
    },
  },
})
