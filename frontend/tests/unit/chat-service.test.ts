import { describe, it, expect, vi, beforeEach } from "vitest"
import { sendChatMessage } from "@/lib/chat/service"
import api from "@/lib/api"
import type { ApiChatMessageResponse } from "@/lib/types/api"

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

describe("Chat Service", () => {
  const mockApiPost = vi.mocked(api.post)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should send message and normalize response", async () => {
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

    const result = await sendChatMessage({
      message: "Olá",
      conversationId: "conv-456",
    })

    expect(result).toEqual({
      responseText: "Olá! Como posso ajudar?",
      transactionCreated: false,
      data: null,
      conversationId: "conv-456",
      uiEvents: [],
    })

    expect(mockApiPost).toHaveBeenCalledWith(
      "/chat/messages",
      {
        text: "Olá",
        content_type: "text",
        conversation_id: "conv-456",
      },
      { timeout: 30000 }
    )
  })

  it("should handle timeout errors", async () => {
    const timeoutError = {
      code: "ECONNABORTED",
      message: "timeout",
    }

    mockApiPost.mockRejectedValue(timeoutError)

    await expect(
      sendChatMessage({ message: "Teste" })
    ).rejects.toThrow("TIMEOUT")
  })

  it("should handle network errors", async () => {
    const networkError = {
      message: "Network Error",
    }

    mockApiPost.mockRejectedValue(networkError)

    await expect(
      sendChatMessage({ message: "Teste" })
    ).rejects.toThrow("NETWORK_ERROR")
  })

  it("should handle 401 unauthorized errors", async () => {
    const unauthorizedError = {
      response: {
        status: 401,
      },
    }

    mockApiPost.mockRejectedValue(unauthorizedError)

    await expect(
      sendChatMessage({ message: "Teste" })
    ).rejects.toThrow("UNAUTHORIZED")
  })

  it("should handle server errors (500+)", async () => {
    const serverError = {
      response: {
        status: 500,
      },
    }

    mockApiPost.mockRejectedValue(serverError)

    await expect(
      sendChatMessage({ message: "Teste" })
    ).rejects.toThrow("SERVER_ERROR")
  })

  it("should handle client errors (400-499)", async () => {
    const clientError = {
      response: {
        status: 400,
      },
    }

    mockApiPost.mockRejectedValue(clientError)

    await expect(
      sendChatMessage({ message: "Teste" })
    ).rejects.toThrow("CLIENT_ERROR")
  })

  it("should send message without conversation ID", async () => {
    const mockResponse: ApiChatMessageResponse = {
      message: {
        id: "msg-123",
        conversation_id: "conv-new",
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

    const result = await sendChatMessage({ message: "Nova conversa" })

    expect(result.conversationId).toBe("conv-new")
    expect(mockApiPost).toHaveBeenCalledWith(
      "/chat/messages",
      {
        text: "Nova conversa",
        content_type: "text",
        conversation_id: undefined,
      },
      { timeout: 30000 }
    )
  })
})
