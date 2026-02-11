"use client"

import { useEffect } from "react"
import { useKeyboardOpen } from "@/lib/hooks/useKeyboardOpen"

const BODY_CLASS = "keyboard-open"

export function KeyboardProvider({ children }: { children: React.ReactNode }) {
  const isKeyboardOpen = useKeyboardOpen()

  useEffect(() => {
    if (isKeyboardOpen) {
      document.body.classList.add(BODY_CLASS)
    } else {
      document.body.classList.remove(BODY_CLASS)
    }
    return () => {
      document.body.classList.remove(BODY_CLASS)
    }
  }, [isKeyboardOpen])

  return <>{children}</>
}
