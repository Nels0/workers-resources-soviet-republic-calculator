import '@testing-library/jest-dom/vitest'
import './win95.css'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Auto-cleanup is disabled via RTL_SKIP_AUTO_CLEANUP in vite config.
// Delay before cleanup so you can see the final rendered state.
afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 2000))
  cleanup()
})
