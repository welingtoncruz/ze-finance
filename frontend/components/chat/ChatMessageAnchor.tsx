"use client"

import type React from "react"
import { useEffect, useRef } from "react"

interface ChatMessageAnchorProps {
  messageId: string
  isActiveMatch?: boolean
  children: React.ReactNode
}

/**
 * Wraps a chat message with a stable DOM anchor (id) for scrolling and highlighting.
 * Applies visual highlight when the message is the active search match.
 */
export function ChatMessageAnchor({
  messageId,
  isActiveMatch = false,
  children,
}: ChatMessageAnchorProps) {
  const anchorRef = useRef<HTMLDivElement>(null)

  // Scroll to anchor when it becomes the active match
  useEffect(() => {
    if (isActiveMatch && anchorRef.current) {
      // Small delay to ensure DOM is ready
      const timeoutId = setTimeout(() => {
        anchorRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        })
      }, 100)

      return () => clearTimeout(timeoutId)
    }
  }, [isActiveMatch])

  return (
    <div
      ref={anchorRef}
      id={`chat-msg-${messageId}`}
      className={`transition-all duration-300 ${
        isActiveMatch
          ? "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg bg-primary/5"
          : ""
      }`}
    >
      {children}
    </div>
  )
}
