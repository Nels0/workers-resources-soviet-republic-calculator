import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://127.0.0.1:5000',
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          setupFiles: './src/test-setup.js',
        },
      },
      {
        extends: true,
        define: {
          'process.env.RTL_SKIP_AUTO_CLEANUP': '"true"',
        },
        test: {
          name: 'browser',
          testTimeout: 30000,
          setupFiles: './src/browser-test-setup.js',
          browser: {
            enabled: true,
            provider: playwright({ launchOptions: { slowMo: 500 } }),
            instances: [{ browser: 'firefox', headless: false }],
          },
          deps: {
            optimizer: {
              web: {
                include: [
                  '@testing-library/jest-dom/vitest',
                  '@testing-library/react/pure',
                  '@testing-library/user-event',
                ],
              },
            },
          },
        },
      },
    ],
  },
})
