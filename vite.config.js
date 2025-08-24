import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import fs from 'fs'

const inputs = { main: resolve(__dirname, 'index.html') }
const admin = resolve(__dirname, 'admin.html')
if (fs.existsSync(admin)) inputs.admin = admin

export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { input: inputs } },
  server: {
    proxy: { '/api': 'http://localhost:4242' } // utile uniquement en DEV
  }
})
