import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // pdfjs-dist ships ESM with top-level await; pre-bundling it breaks the worker resolution.
    exclude: ['pdfjs-dist'],
  },
})
