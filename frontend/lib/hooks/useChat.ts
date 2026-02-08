/**
 * useChat hook: Manages chat state, localStorage persistence, and API interactions.
 */
import { useState, useEffect, useCallback, useRef } from "react"
import type { ChatMessage } from "@/lib/types"
import { sendChatMessage } from "@/lib/chat/service"
import type { ApiTransactionCreatedData } from "@/lib/types/api"

// Storage key: For MVP, using default. In future, can be scoped to userId if available
// Example: `zefa_chat_v1:${userId}` for multi-user support
const STORAGE_KEY = "zefa_chat_v1:default"

interface PersistedChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string // ISO string
  status?: "sending" | "sent" | "error"
  kind?: "text" | "transaction_confirmation" | "ui_event"
  meta?: {
    transactionCreated?: boolean
    data?: ApiTransactionCreatedData
    uiEvent?: {
      type: "success_card" | "warning_card" | "info_card"
      variant: "neon"
      accent: "electric_lime" | "deep_indigo"
      title: string
      subtitle?: string | null
      data?: {
        transaction?: {
          id: string
          amount: number
          type: "INCOME" | "EXPENSE"
          category: string
          description?: string | null
          occurred_at?: string | null
        }
      } | null
    }
  }
  errorCode?: string
  errorMessage?: string
}

interface PersistedChatState {
  conversationId?: string | null
  messages: PersistedChatMessage[]
}

const INITIAL_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Olá! Sou o Zefa, seu assistente financeiro pessoal. 👋\n\n**Nota:** Esta é uma versão prévia. Algumas funcionalidades avançadas (como Insights detalhados e análises profundas) estarão disponíveis em breve.\n\nPor enquanto, posso te ajudar a:\n\n- Analisar seus gastos básicos\n- Adicionar transações\n- Responder dúvidas sobre suas finanças\n- Dar dicas personalizadas\n\nComo posso ajudar?",
  timestamp: new Date(),
  status: "sent",
  kind: "text",
}

function loadFromStorage(): PersistedChatState | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return null
    }

    const parsed = JSON.parse(stored) as PersistedChatState
    return parsed
  } catch (error) {
    console.error("Failed to load chat from localStorage:", error)
    return null
  }
}

function saveToStorage(conversationId: string | null | undefined, messages: ChatMessage[]): void {
  if (typeof window === "undefined") {
    return
  }

  try {
    const persisted: PersistedChatState = {
      conversationId: conversationId || null,
      messages: messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
        status: msg.status,
        kind: msg.kind,
        meta: msg.meta,
        errorCode: msg.errorCode,
        errorMessage: msg.errorMessage,
      })),
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))
  } catch (error) {
    console.error("Failed to save chat to localStorage:", error)
  }
}

function hydrateMessages(persisted: PersistedChatMessage[]): ChatMessage[] {
  return persisted.map((msg) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: new Date(msg.timestamp),
    status: msg.status || "sent",
    kind: msg.kind || "text",
    meta: msg.meta,
    errorCode: msg.errorCode,
    errorMessage: msg.errorMessage,
  }))
}

export interface UseChatReturn {
  messages: ChatMessage[]
  conversationId: string | null
  isAssistantTyping: boolean
  isSending: boolean
  sendMessage: (text: string) => Promise<void>
  retryMessage: (messageId: string) => Promise<void>
  clearConversation: () => void
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isAssistantTyping, setIsAssistantTyping] = useState(false)
  const isSendingRef = useRef(false)
  const hasHydratedRef = useRef(false)

  // Load from localStorage on mount (hydration)
  useEffect(() => {
    const persisted = loadFromStorage()
    if (persisted && persisted.messages.length > 0) {
      const hydrated = hydrateMessages(persisted.messages)
      setMessages(hydrated)
      setConversationId(persisted.conversationId || null)
    } else {
      // Only set initial message if no persisted messages exist
      setMessages([INITIAL_MESSAGE])
    }
    // Mark as hydrated after attempting to load (even if nothing was found)
    hasHydratedRef.current = true
  }, [])

  // Save to localStorage whenever messages or conversationId changes
  // BUT only after hydration is complete to avoid overwriting persisted state
  // Always save, including when only welcome message exists (for clearConversation)
  useEffect(() => {
    if (hasHydratedRef.current && messages.length > 0) {
      saveToStorage(conversationId, messages)
    }
  }, [messages, conversationId])

  const sendMessage = useCallback(
    async (text: string): Promise<void> => {
      if (!text.trim() || isSendingRef.current) {
        return
      }

      const userMessageId = `user-${Date.now()}`
      const userMessage: ChatMessage = {
        id: userMessageId,
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
        status: "sending",
        kind: "text",
      }

      // Optimistic UI: add user message immediately
      setMessages((prev) => [...prev, userMessage])
      setIsAssistantTyping(true)
      isSendingRef.current = true

      try {
        const response = await sendChatMessage({
          message: text.trim(),
          conversationId: conversationId || undefined,
        })

        // Update conversation ID if received
        if (response.conversationId && response.conversationId !== conversationId) {
          setConversationId(response.conversationId)
        }

        // Mark user message as sent
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === userMessageId ? { ...msg, status: "sent" as const } : msg
          )
        )

        // Render UI events from metadata (V2) BEFORE assistant message
        if (response.uiEvents && response.uiEvents.length > 0) {
          for (const uiEvent of response.uiEvents) {
            if (uiEvent.type === "success_card" && uiEvent.data?.transaction) {
              const uiEventMessage: ChatMessage = {
                id: `ui-event-${Date.now()}-${Math.random()}`,
                role: "assistant",
                content: "", // Empty content, card will render
                timestamp: new Date(),
                status: "sent",
                kind: "ui_event",
                meta: {
                  uiEvent: {
                    type: uiEvent.type,
                    variant: uiEvent.variant,
                    accent: uiEvent.accent,
                    title: uiEvent.title,
                    subtitle: uiEvent.subtitle || null,
                    data: uiEvent.data,
                  },
                },
              }
              setMessages((prev) => [...prev, uiEventMessage])
            }
          }
        } else if (response.transactionCreated && response.data) {
          // Fallback: Legacy transaction confirmation (V1 compatibility)
          const confirmationMessage: ChatMessage = {
            id: `confirmation-${Date.now()}`,
            role: "assistant",
            content: "", // Empty content, card will render
            timestamp: new Date(),
            status: "sent",
            kind: "transaction_confirmation",
            meta: {
              transactionCreated: true,
              data: {
                id: response.data.id,
                amount: response.data.amount,
                type: response.data.type.toLowerCase() as "income" | "expense",
                category: response.data.category,
                description: response.data.description || null,
                occurred_at: response.data.occurred_at || null,
              },
            },
          }

          setMessages((prev) => [...prev, confirmationMessage])
        }

        // Add assistant response AFTER UI events
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.responseText,
          timestamp: new Date(),
          status: "sent",
          kind: "text",
        }

        setMessages((prev) => [...prev, assistantMessage])

        setIsAssistantTyping(false)
      } catch (error) {
        // Log error for debugging
        console.error("[useChat] Error sending message:", error)
        
        // Mark user message as error
        const errorMessage =
          error instanceof Error ? error.message : "UNKNOWN_ERROR"

        console.error("[useChat] Error message:", errorMessage)

        let errorCode = "UNKNOWN_ERROR"
        let userFriendlyMessage = "Erro ao enviar mensagem. Tente novamente."

        if (errorMessage === "TIMEOUT") {
          errorCode = "TIMEOUT"
          userFriendlyMessage = "Tempo de espera esgotado. Tente novamente."
        } else if (errorMessage === "NETWORK_ERROR") {
          errorCode = "NETWORK_ERROR"
          userFriendlyMessage = "Erro de conexão. Verifique sua internet."
        } else if (errorMessage === "UNAUTHORIZED") {
          // JWT expired - interceptor will redirect, but mark message as error
          errorCode = "UNAUTHORIZED"
          userFriendlyMessage = "Sessão expirada. Redirecionando..."
        } else if (errorMessage === "SERVER_ERROR") {
          errorCode = "SERVER_ERROR"
          userFriendlyMessage = "Erro no servidor. Tente novamente mais tarde."
        } else if (errorMessage === "CLIENT_ERROR") {
          errorCode = "CLIENT_ERROR"
          userFriendlyMessage = "Erro na requisição. Verifique os dados e tente novamente."
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === userMessageId
              ? {
                  ...msg,
                  status: "error" as const,
                  errorCode,
                  errorMessage: userFriendlyMessage,
                }
              : msg
          )
        )

        setIsAssistantTyping(false)
      } finally {
        isSendingRef.current = false
      }
    },
    [conversationId]
  )

  const retryMessage = useCallback(
    async (messageId: string): Promise<void> => {
      const messageToRetry = messages.find((msg) => msg.id === messageId)
      if (!messageToRetry || messageToRetry.role !== "user") {
        return
      }

      // Remove the failed message and resend
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId))
      await sendMessage(messageToRetry.content)
    },
    [messages, sendMessage]
  )

  const clearConversation = useCallback(() => {
    setMessages([INITIAL_MESSAGE])
    setConversationId(null)
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const isSending = isSendingRef.current

  return {
    messages,
    conversationId,
    isAssistantTyping,
    isSending,
    sendMessage,
    retryMessage,
    clearConversation,
  }
}
