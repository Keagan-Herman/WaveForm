import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

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
    esbuildOptions: {
      // Force CJS modules to be treated correctly
      define: {
        'process.env.NODE_ENV': '"development"',
      },
    },
  },
  server: {
    port: 3000,
  },
})