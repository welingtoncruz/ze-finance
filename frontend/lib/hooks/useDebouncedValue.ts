import { useState, useEffect } from "react"

/**
 * Hook that debounces a value, updating the debounced value only after
 * the specified delay has passed since the last update.
 *
 * @param value - The value to debounce
 * @param delay - The delay in milliseconds (default: 200ms)
 * @returns The debounced value
 */
export function useDebouncedValue<T>(value: T, delay: number = 200): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}
