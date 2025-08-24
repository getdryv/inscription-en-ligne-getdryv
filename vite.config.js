// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import fs from 'fs'

const inputs = {
  main: resolve(__dirname, 'index.html'),
}

const adminPath = resolve(__dirname, 'admin.html')
if (fs.existsSync(adminPath)) {
  inputs.admin = adminPath
}

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: inputs,
    },
  },
})
