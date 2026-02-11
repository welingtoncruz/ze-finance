"use client"

import { useEffect, useState } from "react"

/**
 * Detects when the virtual keyboard is open on mobile.
 * Uses visualViewport API: when the viewport height shrinks significantly
 * (e.g. below 75% of window height), the keyboard is likely open.
 */
export function useKeyboardOpen(): boolean {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null
    if (!vv) return

    const check = (): void => {
      const threshold = 0.75
      const heightRatio = vv.height / window.innerHeight
      setIsOpen(heightRatio < threshold)
    }

    check()
    vv.addEventListener("resize", check)

    return () => vv.removeEventListener("resize", check)
  }, [])

  return isOpen
}
