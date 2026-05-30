import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        // target: 'http://localhost:4000',
        // target: 'https://ajci-backend.vercel.app/',
        target: 'https://ajci-backend.onrender.com/',
        changeOrigin: false,
      },
    },
  },
})
