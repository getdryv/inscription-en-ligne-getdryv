// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'https://inscription-en-ligne-getdryv-1.onrender.com' // en dev, /api ira vers ton serveur
    }
  }
})
