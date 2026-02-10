"use client"

import { useEffect, useState } from "react"

/**
 * Detects if the app is running as an installed PWA (standalone mode).
 * In standalone mode there is no browser chrome, so no native refresh button.
 */
export function useIsStandalone(): boolean {
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const check = (): boolean => {
      if (window.matchMedia?.("(display-mode: standalone)").matches) {
        return true
      }
      const nav = window.navigator as { standalone?: boolean }
      if (typeof nav.standalone === "boolean" && nav.standalone) {
        return true
      }
      return false
    }

    setIsStandalone(check())

    const media = window.matchMedia?.("(display-mode: standalone)")
    const handleChange = (): void => setIsStandalone(check())
    media?.addEventListener?.("change", handleChange)

    return () => media?.removeEventListener?.("change", handleChange)
  }, [])

  return isStandalone
}
