"use client"

import type React from "react"
import { Card } from "@/components/ui/card"
import type { ChatMessage } from "@/lib/types"

export interface ChatSearchResult {
  messageId: string
  role: "user" | "assistant"
  timestamp: Date
  snippet: string
  kind?: "text" | "transaction_confirmation" | "ui_event"
}

interface ChatSearchResultsProps {
  results: ChatSearchResult[]
  activeResultId: string | null
  onSelect: (messageId: string) => void
}

/**
 * Displays a scrollable list of search results.
 * Shows message snippets with role and timestamp.
 */
export function ChatSearchResults({
  results,
  activeResultId,
  onSelect,
}: ChatSearchResultsProps) {
  if (results.length === 0) {
    return null
  }

  return (
    <Card className="mt-2 max-h-48 overflow-y-auto border-border bg-card/95 backdrop-blur-sm">
      <div className="p-2 space-y-1">
        {results.map((result) => {
          const isActive = result.messageId === activeResultId
          return (
            <button
              key={result.messageId}
              onClick={() => onSelect(result.messageId)}
              className={`w-full text-left p-2 rounded-lg transition-colors ${
                isActive
                  ? "bg-primary/10 border border-primary/20"
                  : "hover:bg-muted/50 border border-transparent"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs font-medium ${
                        result.role === "user" ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {result.role === "user" ? "Você" : "Zefa"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {result.timestamp.toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground line-clamp-2 break-words">
                    {result.snippet}
                  </p>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </Card>
  )
}
