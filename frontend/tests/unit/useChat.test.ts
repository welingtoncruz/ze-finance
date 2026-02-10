import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useChat } from "@/lib/hooks/useChat"
import { sendChatMessage } from "@/lib/chat/service"
import type { ApiChatResponse } from "@/lib/types/api"

// Mock chat service
vi.mock("@/lib/chat/service", () => ({
  sendChatMessage: vi.fn(),
}))

// Mock localStorage (implements Storage interface including key/length for clearAllZefaStorage)
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key: (index: number) => {
      const keys = Object.keys(store)
      return keys[index] ?? null
    },
  }
})()

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
})

describe("useChat Hook", () => {
  const mockSendChatMessage = vi.mocked(sendChatMessage)

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
  })

  afterEach(() => {
    localStorageMock.clear()
  })

  it("should initialize with welcome message", () => {
    const { result } = renderHook(() => useChat())

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].role).toBe("assistant")
    expect(result.current.messages[0].content).toContain("Zefa")
    expect(result.current.isAssistantTyping).toBe(false)
    expect(result.current.isSending).toBe(false)
  })

  it("should send a message successfully", async () => {
    const mockResponse: ApiChatResponse = {
      responseText: "Olá! Como posso ajudar?",
      transactionCreated: false,
      data: null,
      conversationId: "conv-123",
    }

    mockSendChatMessage.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage("Olá")
    })

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(3) // welcome + user + assistant
      expect(result.current.messages[1].role).toBe("user")
      expect(result.current.messages[1].content).toBe("Olá")
      expect(result.current.messages[1].status).toBe("sent")
      expect(result.current.messages[2].role).toBe("assistant")
      expect(result.current.messages[2].content).toBe("Olá! Como posso ajudar?")
      expect(result.current.conversationId).toBe("conv-123")
    })

    expect(mockSendChatMessage).toHaveBeenCalledWith({
      message: "Olá",
      conversationId: undefined,
    })
  })

  it("should show optimistic UI when sending", async () => {
    let resolvePromise: (value: ApiChatResponse) => void
    const delayedPromise = new Promise<ApiChatResponse>((resolve) => {
      resolvePromise = resolve
    })

    mockSendChatMessage.mockReturnValue(delayedPromise)

    const { result } = renderHook(() => useChat())

    act(() => {
      result.current.sendMessage("Teste")
    })

    // User message should appear immediately with "sending" status
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[1].status).toBe("sending")
    expect(result.current.isAssistantTyping).toBe(true)

    // Resolve promise
    await act(async () => {
      resolvePromise!({
        responseText: "Resposta",
        transactionCreated: false,
        data: null,
      })
    })

    await waitFor(() => {
      expect(result.current.messages[1].status).toBe("sent")
      expect(result.current.isAssistantTyping).toBe(false)
    })
  })

  it("should handle errors and mark message as error", async () => {
    mockSendChatMessage.mockRejectedValue(new Error("NETWORK_ERROR"))

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage("Teste erro")
    })

    await waitFor(() => {
      const userMessage = result.current.messages.find((m) => m.role === "user")
      expect(userMessage?.status).toBe("error")
      expect(userMessage?.errorCode).toBe("NETWORK_ERROR")
      expect(userMessage?.errorMessage).toContain("conexão")
      expect(result.current.isAssistantTyping).toBe(false)
    })
  })

  it("should handle timeout errors", async () => {
    const timeoutError = new Error("TIMEOUT")
    mockSendChatMessage.mockRejectedValue(timeoutError)

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage("Teste timeout")
    })

    await waitFor(() => {
      const userMessage = result.current.messages.find((m) => m.role === "user")
      expect(userMessage?.status).toBe("error")
      expect(userMessage?.errorCode).toBe("TIMEOUT")
      expect(userMessage?.errorMessage).toContain("Tempo de espera")
    })
  })

  it("should retry a failed message", async () => {
    // First attempt fails
    mockSendChatMessage.mockRejectedValueOnce(new Error("NETWORK_ERROR"))

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage("Mensagem com erro")
    })

    await waitFor(() => {
      expect(result.current.messages.find((m) => m.status === "error")).toBeDefined()
    })

    // Second attempt succeeds
    const mockResponse: ApiChatResponse = {
      responseText: "Sucesso após retry",
      transactionCreated: false,
      data: null,
    }

    mockSendChatMessage.mockResolvedValueOnce(mockResponse)

    const failedMessage = result.current.messages.find((m) => m.status === "error")
    expect(failedMessage).toBeDefined()

    await act(async () => {
      if (failedMessage) {
        await result.current.retryMessage(failedMessage.id)
      }
    })

    await waitFor(() => {
      // Failed message should be removed, new messages added
      expect(result.current.messages.filter((m) => m.status === "error")).toHaveLength(0)
      expect(result.current.messages.find((m) => m.content === "Sucesso após retry")).toBeDefined()
    })
  })

  it("should persist messages to localStorage", async () => {
    const mockResponse: ApiChatResponse = {
      responseText: "Resposta persistida",
      transactionCreated: false,
      data: null,
      conversationId: "conv-456",
    }

    mockSendChatMessage.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage("Mensagem para persistir")
    })

    await waitFor(() => {
      const stored = localStorageMock.getItem("zefa_chat_v1:anonymous")
      expect(stored).toBeTruthy()

      const parsed = JSON.parse(stored!)
      expect(parsed.messages).toHaveLength(3)
      expect(parsed.conversationId).toBe("conv-456")
    })
  })

  it("should restore messages from localStorage", () => {
    const persistedState = {
      conversationId: "conv-789",
      messages: [
        {
          id: "welcome",
          role: "assistant",
          content: "Mensagem restaurada",
          timestamp: new Date().toISOString(),
          status: "sent",
          kind: "text",
        },
        {
          id: "user-1",
          role: "user",
          content: "Mensagem anterior",
          timestamp: new Date().toISOString(),
          status: "sent",
          kind: "text",
        },
      ],
    }

    localStorageMock.setItem("zefa_chat_v1:anonymous", JSON.stringify(persistedState))

    const { result } = renderHook(() => useChat())

    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[0].content).toBe("Mensagem restaurada")
    expect(result.current.messages[1].content).toBe("Mensagem anterior")
    expect(result.current.conversationId).toBe("conv-789")
  })

  it("should not overwrite persisted messages on initial mount (hydration gating)", () => {
    const persistedState = {
      conversationId: "conv-existing",
      messages: [
        {
          id: "msg-1",
          role: "assistant",
          content: "Mensagem persistida",
          timestamp: new Date().toISOString(),
          status: "sent",
          kind: "text",
        },
        {
          id: "msg-2",
          role: "user",
          content: "Mensagem do usuário",
          timestamp: new Date().toISOString(),
          status: "sent",
          kind: "text",
        },
      ],
    }

    localStorageMock.setItem("zefa_chat_v1:anonymous", JSON.stringify(persistedState))

    const { result, unmount } = renderHook(() => useChat())

    // After hydration, messages should be restored
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[0].content).toBe("Mensagem persistida")

    // Unmount and check storage still has persisted data (not overwritten by initial state)
    unmount()

    const stored = localStorageMock.getItem("zefa_chat_v1:anonymous")
    expect(stored).toBeTruthy()
    const parsed = JSON.parse(stored!)
    expect(parsed.messages).toHaveLength(2)
    expect(parsed.messages[0].content).toBe("Mensagem persistida")
  })

  it("should persist messages across mount/unmount/remount cycles", async () => {
    const mockResponse: ApiChatResponse = {
      responseText: "Resposta",
      transactionCreated: false,
      data: null,
      conversationId: "conv-persist",
    }

    mockSendChatMessage.mockResolvedValue(mockResponse)

    // First mount: send a message
    const { result: result1, unmount: unmount1 } = renderHook(() => useChat())

    await act(async () => {
      await result1.current.sendMessage("Mensagem persistente")
    })

    await waitFor(() => {
      expect(result1.current.messages.length).toBeGreaterThan(1)
    })

    unmount1()

    // Verify it's stored
    const storedAfterFirst = localStorageMock.getItem("zefa_chat_v1:anonymous")
    expect(storedAfterFirst).toBeTruthy()

    // Second mount: should restore messages
    const { result: result2 } = renderHook(() => useChat())

    await waitFor(() => {
      expect(result2.current.messages.length).toBeGreaterThan(1)
      const userMsg = result2.current.messages.find((m) => m.content === "Mensagem persistente")
      expect(userMsg).toBeDefined()
    })
  })

  it("should handle transaction confirmation when transactionCreated is true", async () => {
    const mockResponse: ApiChatResponse = {
      responseText: "Transação criada!",
      transactionCreated: true,
      data: {
        id: "tx-123",
        amount: 100.5,
        type: "EXPENSE",
        category: "Food",
        description: "Almoço",
        occurred_at: new Date().toISOString(),
      },
      conversationId: "conv-123",
    }

    mockSendChatMessage.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage("Adicionar despesa de 100.50 em Food")
    })

    await waitFor(() => {
      const confirmationMessage = result.current.messages.find(
        (m) => m.kind === "transaction_confirmation"
      )
      expect(confirmationMessage).toBeDefined()
      expect(confirmationMessage?.meta?.transactionCreated).toBe(true)
      expect(confirmationMessage?.meta?.data?.amount).toBe(100.5)
      expect(confirmationMessage?.meta?.data?.category).toBe("Food")
    })
  })

  it("should clear conversation", async () => {
    const mockResponse: ApiChatResponse = {
      responseText: "Resposta",
      transactionCreated: false,
      data: null,
    }

    mockSendChatMessage.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage("Mensagem")
    })

    await waitFor(() => {
      expect(result.current.messages.length).toBeGreaterThan(1)
    })

    act(() => {
      result.current.clearConversation()
    })

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].id).toBe("welcome")
    expect(result.current.conversationId).toBeNull()

    // After clearing, the welcome message is still persisted (by useEffect)
    // So we check that conversationId is null and only welcome message exists
    const stored = localStorageMock.getItem("zefa_chat_v1:anonymous")
    expect(stored).toBeTruthy()
    const parsed = JSON.parse(stored!)
    expect(parsed.conversationId).toBeNull()
    expect(parsed.messages).toHaveLength(1)
    expect(parsed.messages[0].id).toBe("welcome")
  })
})
