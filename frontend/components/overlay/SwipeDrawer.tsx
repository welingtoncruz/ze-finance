"use client"

import type React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import { X } from "lucide-react"

interface SwipeDrawerProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
}

export function SwipeDrawer({ isOpen, onClose, children, title }: SwipeDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchCurrent, setTouchCurrent] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX)
    setIsDragging(true)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return
    setTouchCurrent(e.touches[0].clientX)
  }, [isDragging])

  const handleTouchEnd = useCallback(() => {
    if (touchStart !== null && touchCurrent !== null) {
      const diff = touchCurrent - touchStart
      if (diff > 100) {
        onClose()
      }
    }
    setTouchStart(null)
    setTouchCurrent(null)
    setIsDragging(false)
  }, [touchStart, touchCurrent, onClose])

  const dragOffset = isDragging && touchStart !== null && touchCurrent !== null
    ? Math.max(0, touchCurrent - touchStart)
    : 0

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown)
      document.body.style.overflow = "hidden"
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="swipe-drawer-overlay open"
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`swipe-drawer open`}
        style={{ transform: `translateX(${dragOffset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        data-testid="tx-drawer"
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </>
  )
}
