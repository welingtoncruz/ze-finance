import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import ChatPage from "@/app/chat/page"
import { AuthProvider } from "@/context/AuthContext"
import api from "@/lib/api"
import type { ApiChatMessageResponse } from "@/lib/types/api"

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/chat",
}))

// Mock api module
vi.mock("@/lib/api", () => ({
  default: {
    post: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
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

// Mock scrollIntoView and scrollTo for HTMLElement (jsdom does not implement these)
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    value: vi.fn(),
    writable: true,
    configurable: true,
  })
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    value: vi.fn(),
    writable: true,
    configurable: true,
  })
})

describe("Chat Integration Tests", () => {
  const mockApiPost = vi.mocked(api.post)

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()

    // Set up authenticated state in localStorage
    if (typeof window !== "undefined") {
      localStorageMock.setItem("zefa_token", "test-token")
    }
  })

  afterEach(() => {
    localStorageMock.clear()
  })

  const renderChatPage = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    return render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ChatPage />
        </AuthProvider>
      </QueryClientProvider>
    )
  }

  it("should render chat screen with welcome message", async () => {
    renderChatPage()

    await waitFor(() => {
      expect(screen.getByText(/Olá! Sou o Zefa/i)).toBeInTheDocument()
    })
  })

  it("should send a message and display user bubble", async () => {
    const mockResponse: ApiChatMessageResponse = {
      message: {
        id: "msg-123",
        conversation_id: "conv-456",
        role: "assistant",
        content: "Olá! Como posso ajudar?",
        content_type: "text",
        created_at: new Date().toISOString(),
      },
      meta: {
        ui_events: [],
        did_create_transaction: false,
        created_transaction_id: null,
        insight_tags: [],
      },
    }

    mockApiPost.mockResolvedValue({
      data: mockResponse,
      status: 201,
      statusText: "Created",
      headers: {},
      config: {} as never,
    })

    renderChatPage()

    const input = await screen.findByPlaceholderText("Digite sua mensagem...")
    const sendButton = screen.getByRole("button", { name: /enviar/i })

    await userEvent.type(input, "Olá Zefa")
    await userEvent.click(sendButton)

    // User message should appear immediately (optimistic UI)
    await waitFor(() => {
      expect(screen.getByText("Olá Zefa")).toBeInTheDocument()
    })

    // Assistant response should appear
    await waitFor(
      () => {
        expect(screen.getByText("Olá! Como posso ajudar?")).toBeInTheDocument()
      },
      { timeout: 3000 }
    )

    expect(mockApiPost).toHaveBeenCalledWith(
      "/chat/messages",
      {
        text: "Olá Zefa",
        content_type: "text",
        conversation_id: undefined,
      },
      { timeout: 30000 }
    )
  })

  it("should show typing indicator while waiting for response", async () => {
    let resolvePromise: (value: unknown) => void
    const delayedPromise = new Promise((resolve) => {
      resolvePromise = resolve
    })

    const mockResponse: ApiChatMessageResponse = {
      message: {
        id: "msg-123",
        conversation_id: "conv-456",
        role: "assistant",
        content: "Resposta",
        content_type: "text",
        created_at: new Date().toISOString(),
      },
      meta: {
        ui_events: [],
        did_create_transaction: false,
        created_transaction_id: null,
        insight_tags: [],
      },
    }

    mockApiPost.mockReturnValue(delayedPromise as never)

    renderChatPage()

    const input = await screen.findByPlaceholderText("Digite sua mensagem...")
    const sendButton = screen.getByRole("button", { name: /enviar/i })

    await userEvent.type(input, "Teste")
    await userEvent.click(sendButton)

    // Typing indicator should appear
    await waitFor(() => {
      expect(screen.getByText(/Zefa está digitando/i)).toBeInTheDocument()
    })

    // Resolve the promise
    resolvePromise!({
      data: mockResponse,
      status: 201,
      statusText: "Created",
      headers: {},
      config: {} as never,
    })

    // Typing indicator should disappear
    await waitFor(
      () => {
        expect(screen.queryByText(/Zefa está digitando/i)).not.toBeInTheDocument()
      },
      { timeout: 3000 }
    )
  })

  it("should handle network errors and show retry button", async () => {
    const networkError = new Error("Network Error")
    mockApiPost.mockRejectedValue(networkError)

    renderChatPage()

    const input = await screen.findByPlaceholderText("Digite sua mensagem...")
    const sendButton = screen.getByRole("button", { name: /enviar/i })

    await userEvent.type(input, "Teste erro")
    await userEvent.click(sendButton)

    // Error message should appear with retry button
    await waitFor(() => {
      expect(screen.getByText(/Erro de conexão/i)).toBeInTheDocument()
      expect(screen.getByText(/Tentar novamente/i)).toBeInTheDocument()
    })
  })

  it("should handle timeout errors", async () => {
    const timeoutError = {
      code: "ECONNABORTED",
      message: "timeout",
    }
    mockApiPost.mockRejectedValue(timeoutError)

    renderChatPage()

    const input = await screen.findByPlaceholderText("Digite sua mensagem...")
    const sendButton = screen.getByRole("button", { name: /enviar/i })

    await userEvent.type(input, "Teste timeout")
    await userEvent.click(sendButton)

    await waitFor(() => {
      expect(screen.getByText(/Tempo de espera esgotado/i)).toBeInTheDocument()
    })
  })

  it("should persist messages in sessionStorage", async () => {
    const mockResponse: ApiChatMessageResponse = {
      message: {
        id: "msg-123",
        conversation_id: "conv-456",
        role: "assistant",
        content: "Resposta persistida",
        content_type: "text",
        created_at: new Date().toISOString(),
      },
      meta: {
        ui_events: [],
        did_create_transaction: false,
        created_transaction_id: null,
        insight_tags: [],
      },
    }

    mockApiPost.mockResolvedValue({
      data: mockResponse,
      status: 201,
      statusText: "Created",
      headers: {},
      config: {} as never,
    })

    renderChatPage()

    const input = await screen.findByPlaceholderText("Digite sua mensagem...")
    const sendButton = screen.getByRole("button", { name: /enviar/i })

    await userEvent.type(input, "Mensagem para persistir")
    await userEvent.click(sendButton)

    await waitFor(
      () => {
        expect(screen.getByText("Resposta persistida")).toBeInTheDocument()
      },
      { timeout: 3000 }
    )

    // Check localStorage
    const stored = localStorageMock.getItem("zefa_chat_v1:anonymous")
    expect(stored).toBeTruthy()

    const parsed = JSON.parse(stored!)
    expect(parsed.messages).toHaveLength(3) // welcome + user + assistant
    expect(parsed.conversationId).toBe("conv-456")
  })

  it("should restore messages from localStorage on mount", async () => {
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

    renderChatPage()

    await waitFor(() => {
      expect(screen.getByText("Mensagem restaurada")).toBeInTheDocument()
      expect(screen.getByText("Mensagem anterior")).toBeInTheDocument()
    })
  })

  it("should disable input while assistant is typing", async () => {
    let resolvePromise: (value: unknown) => void
    const delayedPromise = new Promise((resolve) => {
      resolvePromise = resolve
    })

    const mockResponse: ApiChatMessageResponse = {
      message: {
        id: "msg-123",
        conversation_id: "conv-456",
        role: "assistant",
        content: "Resposta",
        content_type: "text",
        created_at: new Date().toISOString(),
      },
      meta: {
        ui_events: [],
        did_create_transaction: false,
        created_transaction_id: null,
        insight_tags: [],
      },
    }

    mockApiPost.mockReturnValue(delayedPromise as never)

    renderChatPage()

    const input = await screen.findByPlaceholderText("Digite sua mensagem...")
    const sendButton = screen.getByRole("button", { name: /enviar/i })

    await userEvent.type(input, "Teste")
    await userEvent.click(sendButton)

    // Input should be disabled while typing
    await waitFor(() => {
      expect(input).toBeDisabled()
      expect(sendButton).toBeDisabled()
    })

    // Resolve
    resolvePromise!({
      data: mockResponse,
      status: 201,
      statusText: "Created",
      headers: {},
      config: {} as never,
    })

    // Wait for response to be processed and input to be enabled again
    await waitFor(
      () => {
        expect(input).not.toBeDisabled()
        // Send button might still be disabled if input is empty
        // So we check that typing indicator is gone instead
        expect(screen.queryByText(/Zefa está digitando/i)).not.toBeInTheDocument()
      },
      { timeout: 3000 }
    )
  })

  it("should show suggestions when chat is empty", async () => {
    renderChatPage()

    await waitFor(() => {
      expect(screen.getByText("Sugestões:")).toBeInTheDocument()
      expect(screen.getByText("Como estão meus gastos?")).toBeInTheDocument()
      expect(screen.getByText("Quanto economizei?")).toBeInTheDocument()
    })
  })

  it("should hide suggestions after sending messages", async () => {
    const mockResponse: ApiChatMessageResponse = {
      message: {
        id: "msg-123",
        conversation_id: "conv-456",
        role: "assistant",
        content: "Resposta",
        content_type: "text",
        created_at: new Date().toISOString(),
      },
      meta: {
        ui_events: [],
        did_create_transaction: false,
        created_transaction_id: null,
        insight_tags: [],
      },
    }

    mockApiPost.mockResolvedValue({
      data: mockResponse,
      status: 201,
      statusText: "Created",
      headers: {},
      config: {} as never,
    })

    renderChatPage()

    // Send first message
    const input = await screen.findByPlaceholderText("Digite sua mensagem...")
    const sendButton = screen.getByRole("button", { name: /enviar/i })

    await userEvent.type(input, "Primeira mensagem")
    await userEvent.click(sendButton)

    await waitFor(
      () => {
        expect(screen.queryByText("Sugestões:")).not.toBeInTheDocument()
      },
      { timeout: 3000 }
    )
  })
})
