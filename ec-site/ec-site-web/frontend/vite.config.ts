import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// During development /api is proxied to the Go backend (common spec 1.3).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
