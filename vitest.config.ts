import { defineConfig, mergeConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      browser: {
        enabled: true,
        provider: playwright(),
        instances: [
          { browser: 'chromium' },
        ],
        optimizeDeps: {
          include: [
            'zustand',
            'react',
            'react-dom',
            'framer-motion',
            'music-metadata-browser',
            'tinycolor2',
          ],
        },
        headless: true,
      },
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
    },
  })
)
