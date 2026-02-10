"use client"

import { useEffect, useState } from "react"
import { Download, Share2, Smartphone, X } from "lucide-react"

import { usePwaInstall } from "@/lib/hooks/usePwaInstall"
import { Button } from "@/components/ui/button"

const DISMISS_KEY = "zefa_pwa_prompt_dismissed_until"
const DISMISS_DAYS = 7

const isMobileViewport = (): boolean => {
  if (typeof window === "undefined") {
    return false
  }

  return window.matchMedia("(max-width: 1023px)").matches
}

const shouldShowFromStorage = (): boolean => {
  if (typeof window === "undefined") {
    return false
  }

  const raw = window.localStorage.getItem(DISMISS_KEY)
  if (!raw) {
    return true
  }

  const until = Number.parseInt(raw, 10)
  if (Number.isNaN(until)) {
    return true
  }

  return Date.now() > until
}

const persistDismiss = (): void => {
  if (typeof window === "undefined") {
    return
  }

  const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000
  window.localStorage.setItem(DISMISS_KEY, String(until))
}

export const AddToHomeScreenBanner = () => {
  const { canPrompt, isStandalone, isIOS, promptInstall } = usePwaInstall()
  const [visible, setVisible] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    setIsMobile(isMobileViewport())

    const handleResize = () => {
      setIsMobile(isMobileViewport())
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  useEffect(() => {
    if (!isMobile || isStandalone) {
      setVisible(false)
      return
    }

    if (!canPrompt && !isIOS) {
      setVisible(false)
      return
    }

    if (!shouldShowFromStorage()) {
      setVisible(false)
      return
    }

    setVisible(true)
  }, [canPrompt, isIOS, isMobile, isStandalone])

  if (!visible) {
    return null
  }

  const handleDismiss = (): void => {
    persistDismiss()
    setVisible(false)
  }

  const handleInstallClick = async (): Promise<void> => {
    if (canPrompt) {
      await promptInstall()
      persistDismiss()
      setVisible(false)
      return
    }

    handleDismiss()
  }

  const isAndroidLike = !isIOS

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center lg:hidden safe-area-bottom">
      <div className="pointer-events-auto mx-3 mb-3 w-full max-w-md rounded-2xl bg-card/95 px-4 py-3 shadow-[0_-6px_30px_rgba(0,0,0,0.35)] backdrop-blur-md border border-border">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {isAndroidLike ? <Download className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold leading-tight">
                  Instale o Ze Finance na tela inicial
                </p>
                <p className="text-xs text-muted-foreground leading-snug">
                  Use o app em tela cheia, com experiência mais rápida e sem a barra do navegador.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                className="ml-1 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Fechar aviso de instalação do app"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="mt-2 flex items-center gap-2 rounded-xl bg-muted/70 px-3 py-2 text-xs text-muted-foreground">
                <Share2 className="h-3.5 w-3.5 text-primary" />
                <p className="leading-snug">
                  No Safari, toque em <span className="font-semibold">Compartilhar</span> e depois em{" "}
                  <span className="font-semibold">Adicionar à Tela Inicial</span>.
                </p>
              </div>
            ) : (
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Toque em instalar para adicionar à sua tela inicial.
                </p>
                <Button
                  size="sm"
                  className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs"
                  onClick={handleInstallClick}
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Instalar app</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

