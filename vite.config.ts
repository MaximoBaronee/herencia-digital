import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // ethers va en su propio archivo: así ningún archivo supera los 500 kB y el
        // navegador puede reutilizarlo en caché aunque cambie el código de la app
        manualChunks(id) {
          if (id.includes('node_modules/ethers') || id.includes('node_modules/@noble') || id.includes('node_modules/@adraffy')) {
            return 'ethers'
          }
        },
      },
    },
  },
})
