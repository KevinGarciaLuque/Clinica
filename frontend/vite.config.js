/* global process */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Identificador único de cada compilación: queda dentro de la app (__BUILD_ID__) y en /version.json.
// La app abierta compara ambos para avisar «Hay una nueva versión» (AvisoNuevaVersion).
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now())
const versionJson = () => ({
  name: 'version-json',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID }) })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), versionJson()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-') || id.includes('node_modules/victory-')) {
            return 'vendor-charts';
          }
          if (id.includes('node_modules/@fullcalendar') || id.includes('node_modules/fullcalendar')) {
            return 'vendor-calendar';
          }
        }
      }
    }
  }
})
