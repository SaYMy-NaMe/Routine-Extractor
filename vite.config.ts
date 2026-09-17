import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // pdfjs-dist ships ESM with top-level await; pre-bundling it breaks worker resolution.
    exclude: ['pdfjs-dist'],
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    // Heavy libraries (pdfjs, jspdf, docx, fflate) are imported lazily and land in their own chunks;
    // keep the framework in a stable vendor chunk for long-term caching.
    rollupOptions: {
      output: {
        manualChunks: (id) => (/node_modules\/(react|react-dom|scheduler)\//.test(id) ? 'react' : undefined),
      },
    },
  },
})
