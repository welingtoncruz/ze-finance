"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { useIsStandalone } from "@/lib/hooks/useIsStandalone"

const PULL_THRESHOLD = 60
const PULL_MAX_VISUAL = 80

interface PullToRefreshProps {
  children: React.ReactNode
  onRefresh: () => Promise<void> | void
  /** Only enable on mobile viewport (e.g. width < 1024). Default true. */
  mobileOnly?: boolean
}

export function PullToRefresh({
  children,
  onRefresh,
  mobileOnly = true,
}: PullToRefreshProps) {
  const isStandalone = useIsStandalone()
  const [isMobile, setIsMobile] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const touchStartYRef = useRef<number | null>(null)
  const pullActiveRef = useRef(false)
  const pullDistanceRef = useRef(0)

  useEffect(() => {
    pullDistanceRef.current = pullDistance
  }, [pullDistance])

  useEffect(() => {
    if (!mobileOnly) {
      setIsMobile(true)
      return
    }
    const check = () => setIsMobile(typeof window !== "undefined" && window.innerWidth < 1024)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [mobileOnly])

  const resetPull = useCallback(() => {
    touchStartYRef.current = null
    pullActiveRef.current = false
    setPullDistance(0)
  }, [])

  useEffect(() => {
    if (!isStandalone || !isMobile) return

    const handleTouchStart = (e: TouchEvent) => {
      const scrollTop = document.documentElement.scrollTop
      if (scrollTop === 0) {
        touchStartYRef.current = e.touches[0].clientY
        pullActiveRef.current = true
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!pullActiveRef.current || touchStartYRef.current === null) return

      const scrollTop = document.documentElement.scrollTop
      if (scrollTop > 0) {
        resetPull()
        return
      }

      const currentY = e.touches[0].clientY
      const delta = currentY - touchStartYRef.current

      if (delta > 0) {
        const distance = Math.min(delta * 0.5, PULL_MAX_VISUAL)
        setPullDistance(distance)
        if (distance > 10) {
          e.preventDefault()
        }
      }
    }

    const handleTouchEnd = async () => {
      const distance = pullDistanceRef.current
      pullActiveRef.current = false
      touchStartYRef.current = null
      setPullDistance(0)

      if (distance >= PULL_THRESHOLD) {
        setIsRefreshing(true)
        try {
          await onRefresh()
        } finally {
          setIsRefreshing(false)
        }
      }
    }

    document.addEventListener("touchstart", handleTouchStart, { passive: true })
    document.addEventListener("touchmove", handleTouchMove, { passive: false })
    document.addEventListener("touchend", handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener("touchstart", handleTouchStart)
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("touchend", handleTouchEnd)
    }
  }, [isStandalone, isMobile, onRefresh, resetPull])

  const showIndicator = pullDistance > 0 || isRefreshing

  if (!isStandalone || !isMobile) {
    return <>{children}</>
  }

  return (
    <>
      {showIndicator && (
        <div
          className="fixed left-0 right-0 top-0 z-50 flex items-center justify-center gap-2 bg-background/95 py-3 backdrop-blur-sm transition-opacity duration-200 lg:hidden"
          style={{
            height: isRefreshing ? 48 : Math.min(pullDistance, PULL_MAX_VISUAL),
            opacity: showIndicator ? 1 : 0,
          }}
        >
          {isRefreshing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Atualizando…</span>
            </>
          ) : (
            <Loader2
              className="h-5 w-5 text-primary transition-transform duration-150"
              style={{
                transform: `rotate(${Math.min(pullDistance / PULL_THRESHOLD, 1) * 180}deg)`,
              }}
            />
          )}
        </div>
      )}
      {children}
    </>
  )
}
