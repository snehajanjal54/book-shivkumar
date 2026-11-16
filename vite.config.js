
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/book-shivkumar/',
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:4000",
    },
  },
})
