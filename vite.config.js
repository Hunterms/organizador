import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Base path. Served at the domain ROOT on Vercel, so default is '/'.
// For GitHub Pages (served under /organizador/), build with:
//   BASE_PATH=/organizador/ npm run build
export default defineConfig(() => ({
  base: process.env.BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
}))
