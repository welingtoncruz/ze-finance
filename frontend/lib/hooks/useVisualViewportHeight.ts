"use client"

import { useEffect, useState } from "react"

/**
 * Tracks visualViewport.height for mobile keyboard handling.
 * When the virtual keyboard opens, the visual viewport shrinks.
 * Using this height for the chat container keeps header and input visible.
 */
export function useVisualViewportHeight(): number | null {
  const [height, setHeight] = useState<number | null>(null)

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null
    if (!vv) {
      return
    }

    const update = (): void => {
      if (vv) setHeight(vv.height)
    }

    update()
    vv.addEventListener("resize", update)
    vv.addEventListener("scroll", update)

    return () => {
      vv.removeEventListener("resize", update)
      vv.removeEventListener("scroll", update)
    }
  }, [])

  return height
}
