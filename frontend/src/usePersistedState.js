import { useState, useEffect } from 'react'

/**
 * Like useState, but the value is persisted to localStorage under `key`.
 * On mount, the stored value is read synchronously so there's no flash.
 * Setting value to null/undefined removes the key from storage.
 *
 * Keys should be namespaced, e.g. 'wrsr:selectedProjectId'.
 */
export function usePersistedState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored !== null ? JSON.parse(stored) : defaultValue
    } catch {
      return defaultValue
    }
  })

  useEffect(() => {
    try {
      if (value === null || value === undefined) {
        localStorage.removeItem(key)
      } else {
        localStorage.setItem(key, JSON.stringify(value))
      }
    } catch {
      // storage quota exceeded or blocked — silently ignore
    }
  }, [key, value])

  return [value, setValue]
}
