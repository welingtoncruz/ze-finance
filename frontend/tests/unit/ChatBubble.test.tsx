import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { ChatBubble } from "@/components/chat/ChatBubble"
import type { ChatMessage } from "@/lib/types"

// Mock react-markdown to avoid issues in test environment
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}))

vi.mock("remark-gfm", () => ({
  default: () => {},
}))

describe("ChatBubble", () => {
  const baseMessage: ChatMessage = {
    id: "test-msg",
    role: "assistant",
    content: "Test message",
    timestamp: new Date(),
    status: "sent",
    kind: "text",
  }

  it("should render user message with primary theme colors", () => {
    const userMessage: ChatMessage = {
      ...baseMessage,
      role: "user",
      content: "User message",
    }

    const { container } = render(<ChatBubble message={userMessage} />)

    const bubble = container.querySelector(".bg-primary")
    expect(bubble).toBeInTheDocument()
    expect(bubble).toHaveClass("text-primary-foreground")
  })

  it("should render assistant message with muted theme colors", () => {
    const assistantMessage: ChatMessage = {
      ...baseMessage,
      role: "assistant",
      content: "Assistant message",
    }

    const { container } = render(<ChatBubble message={assistantMessage} />)

    const bubble = container.querySelector(".bg-muted")
    expect(bubble).toBeInTheDocument()
    expect(bubble).toHaveClass("text-foreground")
  })

  it("should render message content", () => {
    render(<ChatBubble message={baseMessage} />)

    expect(screen.getByTestId("markdown")).toBeInTheDocument()
  })

  it("should render error state with retry button", () => {
    const errorMessage: ChatMessage = {
      ...baseMessage,
      status: "error",
      errorMessage: "Erro de conexão",
    }

    render(<ChatBubble message={errorMessage} onRetry={vi.fn()} />)

    expect(screen.getByText("Erro de conexão")).toBeInTheDocument()
    expect(screen.getByText(/Tentar novamente/i)).toBeInTheDocument()
  })

  it("should render sending state", () => {
    const sendingMessage: ChatMessage = {
      ...baseMessage,
      status: "sending",
    }

    render(<ChatBubble message={sendingMessage} />)

    expect(screen.getByText("Enviando...")).toBeInTheDocument()
  })

  it("should render timestamp", () => {
    const now = new Date()
    const messageWithTime: ChatMessage = {
      ...baseMessage,
      timestamp: now,
    }

    render(<ChatBubble message={messageWithTime} />)

    const timeString = now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })
    expect(screen.getByText(timeString)).toBeInTheDocument()
  })

  it("should not show timestamp when sending", () => {
    const sendingMessage: ChatMessage = {
      ...baseMessage,
      status: "sending",
      timestamp: new Date(),
    }

    const { container } = render(<ChatBubble message={sendingMessage} />)

    // Timestamp should not be visible (it's conditionally rendered)
    const timestamp = container.querySelector('p[class*="text-[10px]"]')
    expect(timestamp).not.toBeInTheDocument()
  })
})
