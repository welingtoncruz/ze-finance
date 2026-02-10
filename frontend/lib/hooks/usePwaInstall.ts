"use client"

import { useCallback, useEffect, useState } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{
    outcome: "accepted" | "dismissed"
    platform?: string
  }>
}

const isStandaloneDisplayMode = (): boolean => {
  if (typeof window === "undefined") {
    return false
  }

  if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) {
    return true
  }

  // iOS Safari
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigatorAny = window.navigator as any
  if (typeof navigatorAny.standalone === "boolean" && navigatorAny.standalone) {
    return true
  }

  return false
}

const detectIsIos = (): boolean => {
  if (typeof window === "undefined") {
    return false
  }

  const userAgent = window.navigator.userAgent || ""
  return /iPad|iPhone|iPod/.test(userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream
}

export interface UsePwaInstallState {
  canPrompt: boolean
  isStandalone: boolean
  isIOS: boolean
  promptInstall: () => Promise<void>
}

export const usePwaInstall = (): UsePwaInstallState => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState<boolean>(false)
  const [isIOS, setIsIOS] = useState<boolean>(false)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    setIsStandalone(isStandaloneDisplayMode())
    setIsIOS(detectIsIos())

    const beforeInstallHandler = (event: Event): void => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    window.addEventListener("beforeinstallprompt", beforeInstallHandler as EventListener)

    const media = window.matchMedia?.("(display-mode: standalone)")
    const handleDisplayModeChange = (): void => {
      setIsStandalone(isStandaloneDisplayMode())
    }

    media?.addEventListener?.("change", handleDisplayModeChange)

    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstallHandler as EventListener)
      media?.removeEventListener?.("change", handleDisplayModeChange)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) {
      return
    }

    try {
      await deferredPrompt.prompt()
      await deferredPrompt.userChoice
      setDeferredPrompt(null)
    } catch {
      // Swallow errors; install prompt outcome is non-critical.
    }
  }, [deferredPrompt])

  return {
    canPrompt: Boolean(deferredPrompt),
    isStandalone,
    isIOS,
    promptInstall,
  }
}

