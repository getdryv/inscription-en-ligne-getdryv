// vite.config.js
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // charge les variables VITE_* depuis l'env (DEV/CI/Render)
  const env = loadEnv(mode, process.cwd(), '') // pas de prefix filter

  return {
    plugins: [react()],
    server: {
      proxy: {
        // En DEV seulement. En prod (Render Static Site), cette section est ignorée.
        '/api': env.VITE_API_BASE || 'http://localhost:4242'
      }
    }
  }
})
