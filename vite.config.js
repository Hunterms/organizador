import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Base path for GitHub Pages.
// In dev, root. In prod build, prefixed with /organizador/.
// Override with BASE_PATH env if deploying to a different repo name.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? (process.env.BASE_PATH || '/organizador/') : '/',
  plugins: [react(), tailwindcss()],
}))
