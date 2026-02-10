"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback, memo, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ArrowLeft,
  Send,
  Sparkles,
  TrendingUp,
  PiggyBank,
  Receipt,
  Lightbulb,
  Plus,
  Search,
  ChevronDown,
} from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { useChat } from "@/lib/hooks/useChat"
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue"
import { useVisualViewportHeight } from "@/lib/hooks/useVisualViewportHeight"
import { ChatBubble } from "./ChatBubble"
import { TypingIndicator } from "./TypingIndicator"
import { TransactionConfirmationCard } from "./TransactionConfirmationCard"
import { ChatMessageAnchor } from "./ChatMessageAnchor"
import { ChatSearchBar } from "./ChatSearchBar"
import type { ChatSearchResult } from "./ChatSearchResults"
import type { ChatMessage } from "@/lib/types"

// Memoized message list component to prevent re-renders on input changes
const ChatMessagesList = memo(function ChatMessagesList({
  messages,
  renderMessage,
}: {
  messages: ChatMessage[]
  renderMessage: (message: ChatMessage) => React.ReactNode
}) {
  return (
    <>
      {messages.map(renderMessage)}
    </>
  )
})

const SUGGESTIONS = [
  { icon: TrendingUp, text: "Como estão meus gastos?", color: "text-primary" },
  { icon: PiggyBank, text: "Quanto economizei?", color: "text-success-foreground" },
  { icon: Receipt, text: "Adicionar despesa", color: "text-destructive" },
  { icon: Lightbulb, text: "Dicas para economizar", color: "text-accent-foreground" },
]

export function ZefaChatScreen() {
  const router = useRouter()
  const {
    messages,
    isAssistantTyping,
    sendMessage,
    retryMessage,
  } = useChat()

  const [inputValue, setInputValue] = useState("")
  const [isInputFocused, setIsInputFocused] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const viewportHeight = useVisualViewportHeight()

  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1)
  const debouncedQuery = useDebouncedValue(searchQuery, 200)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior })
    }
  }, [])

  // Initial scroll to bottom when chat opens
  const hasInitialScrolledRef = useRef(false)
  useEffect(() => {
    if (messages.length > 0 && !hasInitialScrolledRef.current) {
      setTimeout(() => {
        scrollToBottom("auto")
        hasInitialScrolledRef.current = true
      }, 100)
    }
  }, [messages.length, scrollToBottom])

  // Auto-scroll to bottom when NEW messages arrive
  const previousMessagesLengthRef = useRef(messages.length)
  useEffect(() => {
    const hasNewMessage = messages.length > previousMessagesLengthRef.current
    previousMessagesLengthRef.current = messages.length

    if (hasNewMessage && hasInitialScrolledRef.current && isAtBottom) {
      scrollToBottom("smooth")
    }
  }, [messages.length, scrollToBottom, isAtBottom])

  // Auto-scroll when assistant is typing
  useEffect(() => {
    if (isAssistantTyping && isAtBottom) {
      scrollToBottom("smooth")
    }
  }, [isAssistantTyping, scrollToBottom, isAtBottom])

  const handleMessagesScroll = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const threshold = 80
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    const isNearBottom = distanceFromBottom <= threshold
    setIsAtBottom(isNearBottom)
  }, [])

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
    }
    if (!inputValue.trim() || isAssistantTyping) {
      return
    }

    const text = inputValue.trim()
    setInputValue("")
    await sendMessage(text)
  }, [inputValue, isAssistantTyping, sendMessage])

  const handleSendButtonClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    handleSubmit()
  }, [handleSubmit])

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion)
  }

  // Search logic: build searchable text for each message
  const buildSearchableText = useCallback((message: ChatMessage): string => {
    if (message.kind === "text") {
      return message.content || ""
    }
    if (message.kind === "ui_event" && message.meta?.uiEvent) {
      const uiEvent = message.meta.uiEvent
      const parts: string[] = []
      if (uiEvent.title) parts.push(uiEvent.title)
      if (uiEvent.subtitle) parts.push(uiEvent.subtitle)
      if (uiEvent.data?.transaction) {
        const tx = uiEvent.data.transaction
        if (tx.category) parts.push(tx.category)
        if (tx.description) parts.push(tx.description)
        if (tx.amount) parts.push(tx.amount.toString())
      }
      return parts.join(" ")
    }
    if (message.kind === "transaction_confirmation" && message.meta?.data) {
      const data = message.meta.data
      const parts: string[] = []
      if (data.category) parts.push(data.category)
      if (data.description) parts.push(data.description)
      if (data.amount) parts.push(data.amount.toString())
      return parts.join(" ")
    }
    return ""
  }, [])

  // Normalize text for search (remove diacritics for PT-BR)
  const normalizeText = useCallback((text: string): string => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
  }, [])

  // Derive search results from messages
  const searchResults = useMemo<ChatSearchResult[]>(() => {
    if (!debouncedQuery.trim()) {
      return []
    }

    const normalizedQuery = normalizeText(debouncedQuery.trim())
    const results: ChatSearchResult[] = []

    messages.forEach((message) => {
      const searchableText = buildSearchableText(message)
      if (!searchableText) return

      const normalizedText = normalizeText(searchableText)
      if (normalizedText.includes(normalizedQuery)) {
        // Create snippet (first 100 chars or until match)
        const matchIndex = normalizedText.indexOf(normalizedQuery)
        const start = Math.max(0, matchIndex - 20)
        const end = Math.min(searchableText.length, matchIndex + normalizedQuery.length + 80)
        const snippet = searchableText.slice(start, end)
        const prefix = start > 0 ? "..." : ""
        const suffix = end < searchableText.length ? "..." : ""

        results.push({
          messageId: message.id,
          role: message.role,
          timestamp: message.timestamp,
          snippet: `${prefix}${snippet}${suffix}`,
          kind: message.kind,
        })
      }
    })

    return results
  }, [messages, debouncedQuery, buildSearchableText, normalizeText])

  // Active match message ID
  const activeMatchMessageId = useMemo(() => {
    if (activeMatchIndex >= 0 && activeMatchIndex < searchResults.length) {
      return searchResults[activeMatchIndex].messageId
    }
    return null
  }, [activeMatchIndex, searchResults])

  // Navigation handlers
  const handleSearchNext = useCallback(() => {
    if (searchResults.length === 0) return
    setActiveMatchIndex((prev) => (prev + 1) % searchResults.length)
  }, [searchResults.length])

  const handleSearchPrev = useCallback(() => {
    if (searchResults.length === 0) return
    setActiveMatchIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length)
  }, [searchResults.length])


  const handleSearchClose = useCallback(() => {
    setIsSearchOpen(false)
    setSearchQuery("")
    setActiveMatchIndex(-1)
  }, [])

  // Reset active match when query changes
  useEffect(() => {
    if (debouncedQuery.trim()) {
      setActiveMatchIndex(0)
    } else {
      setActiveMatchIndex(-1)
    }
  }, [debouncedQuery])

  // Keyboard shortcuts for search
  useEffect(() => {
    if (!isSearchOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleSearchClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isSearchOpen, handleSearchClose])

  // Memoize renderMessage to avoid recreating on every render
  const renderMessage = useCallback(
    (message: ChatMessage) => {
      const isActiveMatch = activeMatchMessageId === message.id

      // Render UI event cards (V2)
      if (message.kind === "ui_event" && message.meta?.uiEvent) {
        return (
          <ChatMessageAnchor
            key={message.id}
            messageId={message.id}
            isActiveMatch={isActiveMatch}
          >
            <TransactionConfirmationCard uiEvent={message.meta.uiEvent} />
          </ChatMessageAnchor>
        )
      }

      // Fallback: Legacy transaction confirmation (V1 compatibility)
      if (message.kind === "transaction_confirmation" && message.meta?.data) {
        // Convert legacy format to UI event format for rendering
        const legacyUiEvent = {
          type: "success_card" as const,
          variant: "neon" as const,
          accent: "electric_lime" as const,
          title: "Transação criada com sucesso!",
          subtitle: null,
          data: {
            transaction: {
              id: message.meta.data.id,
              amount: message.meta.data.amount,
              type: message.meta.data.type.toUpperCase() as "INCOME" | "EXPENSE",
              category: message.meta.data.category,
              description: message.meta.data.description || null,
              occurred_at: message.meta.data.occurred_at || null,
            },
          },
        }
        return (
          <ChatMessageAnchor
            key={message.id}
            messageId={message.id}
            isActiveMatch={isActiveMatch}
          >
            <TransactionConfirmationCard uiEvent={legacyUiEvent} />
          </ChatMessageAnchor>
        )
      }

      return (
        <ChatMessageAnchor
          key={message.id}
          messageId={message.id}
          isActiveMatch={isActiveMatch}
        >
          <ChatBubble
            message={message}
            onRetry={message.status === "error" ? retryMessage : undefined}
            searchQuery={isActiveMatch ? debouncedQuery : undefined}
            isActiveMatch={isActiveMatch}
          />
        </ChatMessageAnchor>
      )
    },
    [retryMessage, activeMatchMessageId, debouncedQuery]
  )

  const containerStyle =
    viewportHeight != null
      ? { height: viewportHeight, maxHeight: viewportHeight }
      : undefined

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-background theme-transition overflow-hidden shrink-0"
      style={containerStyle}
    >
      {/* Mobile Header - gradient, matches Dashboard/Insights/Transactions */}
      <header className="sticky top-0 z-10 shrink-0 gradient-header px-3 py-4 sm:px-6 sm:py-5 safe-area-top lg:hidden">
        {isSearchOpen ? (
          <div className="mx-auto flex max-w-2xl lg:max-w-4xl items-center">
            <ChatSearchBar
              query={searchQuery}
              setQuery={setSearchQuery}
              matchCount={searchResults.length}
              activeIndex={activeMatchIndex}
              onNext={handleSearchNext}
              onPrev={handleSearchPrev}
              onClose={handleSearchClose}
              isMobile={true}
              variant="header"
            />
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl lg:max-w-4xl items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="rounded-xl p-2.5 transition-all hover:bg-primary-foreground/10 active:scale-95"
                aria-label="Voltar"
              >
                <ArrowLeft className="h-5 w-5 text-primary-foreground" />
              </button>
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary-foreground/15 shadow-lg">
                  <Sparkles className="h-5 w-5 text-primary-foreground" />
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-success ring-2 ring-background" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-primary-foreground">Zefa</h1>
                  <p className="text-xs text-primary-foreground/70">Online</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSearchOpen(true)}
                className="rounded-xl p-2.5 transition-all hover:bg-primary-foreground/10 active:scale-95"
                aria-label="Buscar mensagens"
              >
                <Search className="h-5 w-5 text-primary-foreground" />
              </button>
              <ThemeToggle variant="header" />
            </div>
          </div>
        )}
      </header>

      {/* Desktop Header - unchanged from original */}
      <header className="hidden lg:block sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 pt-4 pb-3 px-4 sm:pt-6 sm:pb-4 sm:px-6">
        {isSearchOpen ? (
          <div className="mx-auto flex max-w-2xl lg:max-w-4xl items-center">
            <ChatSearchBar
              query={searchQuery}
              setQuery={setSearchQuery}
              matchCount={searchResults.length}
              activeIndex={activeMatchIndex}
              onNext={handleSearchNext}
              onPrev={handleSearchPrev}
              onClose={handleSearchClose}
              isMobile={false}
            />
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl lg:max-w-4xl items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-lg">
                  <Sparkles className="h-5 w-5 text-primary-foreground" />
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-success ring-2 ring-card" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground">Zefa</h1>
                  <p className="text-xs text-success-foreground">Online</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSearchOpen(true)}
                className="rounded-xl p-2.5 transition-all hover:bg-muted active:scale-95"
                aria-label="Buscar mensagens"
              >
                <Search className="h-5 w-5 text-foreground" />
              </button>
              <ThemeToggle variant="standalone" />
            </div>
          </div>
        )}
      </header>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="min-h-0 flex-1 overflow-y-auto py-4 px-3 sm:px-4"
        onScroll={handleMessagesScroll}
      >
        <div className="mx-auto max-w-2xl lg:max-w-4xl space-y-4">
          <ChatMessagesList messages={messages} renderMessage={renderMessage} />

          {/* Typing indicator */}
          {isAssistantTyping && <TypingIndicator />}

          {/* Scroll to latest button */}
          {!isAtBottom && (
            <div className="sticky bottom-4 flex justify-center">
              <button
                type="button"
                onClick={() => scrollToBottom("smooth")}
                className="inline-flex items-center gap-1 rounded-full bg-card px-3 py-1 text-xs font-medium text-foreground shadow-md ring-1 ring-border/60 hover:bg-muted transition-colors"
              >
                <ChevronDown className="h-3 w-3" />
                Ver mensagens recentes
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Suggestions - Show only when chat is empty (only welcome message) */}
      {!isAssistantTyping && 
       !isInputFocused && 
       inputValue.trim() === "" && 
       messages.length === 1 && 
       messages[0].id === "welcome" && (
        <div className="shrink-0 border-t border-border bg-card/50 py-3 px-3 sm:px-4">
          <div className="mx-auto max-w-2xl lg:max-w-4xl">
            <p className="mb-2 text-xs text-muted-foreground">Sugestões:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion.text}
                  onClick={() => handleSuggestionClick(suggestion.text)}
                  disabled={isAssistantTyping}
                  className="suggestion-chip flex items-center gap-2 rounded-full bg-muted px-3 py-2 text-sm font-medium text-foreground transition-all hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <suggestion.icon className={`h-4 w-4 ${suggestion.color}`} />
                  {suggestion.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="chat-input-container shrink-0 py-3 mb-4 px-3 safe-area-bottom sm:py-4 sm:px-4">
        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl lg:max-w-4xl">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/transactions?add=true")}
              className="rounded-full bg-primary/10 p-3 text-primary transition-all hover:bg-primary/20 active:scale-95"
              aria-label="Adicionar transação"
            >
              <Plus className="h-5 w-5" />
            </button>
            <div className="relative flex-1">
              <Input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                placeholder="Digite sua mensagem..."
                disabled={isAssistantTyping}
                enterKeyHint="send"
                className="chat-input h-12 rounded-full border-border/50 bg-muted/50 pr-12 pl-4 transition-all focus:bg-background disabled:opacity-50"
              />
            </div>
            <Button
              type="submit"
              onClick={handleSendButtonClick}
              disabled={!inputValue.trim() || isAssistantTyping}
              aria-label="Enviar mensagem"
              className="h-12 w-12 rounded-full p-0 shadow-lg transition-all hover:shadow-xl disabled:opacity-50"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
