"use client"

import type React from "react"
import { useRef, useEffect } from "react"
import { Search, X, ChevronUp, ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface ChatSearchBarProps {
  query: string
  setQuery: (query: string) => void
  matchCount: number
  activeIndex: number
  onNext: () => void
  onPrev: () => void
  onClose: () => void
  isMobile?: boolean
  /** When true, uses primary-foreground colors for contrast on gradient header */
  variant?: "default" | "header"
}

/**
 * Search bar component for chat message search.
 * Shows input, match counter, navigation controls, and close button.
 */
export function ChatSearchBar({
  query,
  setQuery,
  matchCount,
  activeIndex,
  onNext,
  onPrev,
  onClose,
  isMobile = false,
  variant = "default",
}: ChatSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when component mounts or becomes visible
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      onClose()
    } else if (e.key === "Enter") {
      if (e.shiftKey) {
        onPrev()
      } else {
        onNext()
      }
    }
  }

  const iconClass = variant === "header" ? "text-primary-foreground" : "text-muted-foreground"
  const counterClass = variant === "header" ? "text-primary-foreground/90" : "text-muted-foreground"

  return (
    <div className={`flex items-center gap-2 w-full ${variant === "header" ? "text-primary-foreground" : ""}`}>
      <div className="relative flex-1">
        <Search className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${iconClass}`} />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar mensagens..."
          className="pl-9 pr-9 h-10"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-muted transition-colors"
            aria-label="Limpar busca"
          >
            <X className={`h-4 w-4 ${iconClass}`} />
          </button>
        )}
      </div>

      {matchCount > 0 && (
        <>
          <div className={`flex items-center gap-1 text-xs whitespace-nowrap ${counterClass}`}>
            <span>
              {activeIndex + 1}/{matchCount}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onPrev}
              disabled={matchCount === 0}
              className={`h-8 w-8 p-0 ${variant === "header" ? "text-primary-foreground hover:text-primary-foreground/80 hover:bg-primary-foreground/10" : ""}`}
              aria-label="Resultado anterior"
            >
              <ChevronUp className={`h-4 w-4 ${iconClass}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onNext}
              disabled={matchCount === 0}
              className={`h-8 w-8 p-0 ${variant === "header" ? "text-primary-foreground hover:text-primary-foreground/80 hover:bg-primary-foreground/10" : ""}`}
              aria-label="Próximo resultado"
            >
              <ChevronDown className={`h-4 w-4 ${iconClass}`} />
            </Button>
          </div>
        </>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={onClose}
        className={`h-8 w-8 p-0 ${variant === "header" ? "text-primary-foreground hover:text-primary-foreground/80 hover:bg-primary-foreground/10" : ""}`}
        aria-label="Fechar busca"
      >
        <X className={`h-4 w-4 ${iconClass}`} />
      </Button>
    </div>
  )
}
