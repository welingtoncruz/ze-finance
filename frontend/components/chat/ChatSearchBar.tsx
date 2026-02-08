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

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {matchCount > 0 && (
        <>
          <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
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
              className="h-8 w-8 p-0"
              aria-label="Resultado anterior"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onNext}
              disabled={matchCount === 0}
              className="h-8 w-8 p-0"
              aria-label="Próximo resultado"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={onClose}
        className="h-8 w-8 p-0"
        aria-label="Fechar busca"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
