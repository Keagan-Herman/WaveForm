import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: [
      'react-reconciler',
      'react-reconciler/constants',
      '@react-three/fiber',
      '@react-three/drei',
    ],
    rolldownOptions: {
      // Force CJS modules to be treated correctly
      transform: {
        define: {
          'process.env.NODE_ENV': '"development"',
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/deezer-api': {
        target: 'https://api.deezer.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/deezer-api/, ''),
      },
    },
  },
})