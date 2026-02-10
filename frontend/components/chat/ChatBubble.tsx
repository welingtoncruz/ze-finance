"use client"

import type React from "react"
import { memo } from "react"
import { RefreshCcw, AlertTriangle } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import { Button } from "@/components/ui/button"
import { highlightSearchTerms } from "@/lib/markdown/remarkHighlightSearch"
import type { ChatMessage } from "@/lib/types"

interface ChatBubbleProps {
  message: ChatMessage
  onRetry?: (messageId: string) => void
  searchQuery?: string
  isActiveMatch?: boolean
}

export const ChatBubble = memo(function ChatBubble({
  message,
  onRetry,
  searchQuery,
  isActiveMatch = false,
}: ChatBubbleProps) {
  const isUser = message.role === "user"

  const isError = message.status === "error"
  const isSending = message.status === "sending"

  // Normalize content: collapse 3+ newlines to 2 to avoid "double enter" gaps from empty paragraphs
  const normalizedContent = (message.content ?? "").replace(/\n{3,}/g, "\n\n")

  // Highlight search terms in content if this is the active match
  const contentToRender =
    isActiveMatch && searchQuery && normalizedContent
      ? highlightSearchTerms(normalizedContent, searchQuery)
      : normalizedContent

  // Sanitize schema: allow only <mark data-search-highlight="true"> from raw HTML (search highlights).
  // All other raw HTML is stripped; prevents XSS from user/AI content.
  const sanitizeSchema = {
    ...defaultSchema,
    tagNames: [...(defaultSchema.tagNames ?? []), "mark"],
    attributes: {
      ...defaultSchema.attributes,
      mark: [["dataSearchHighlight", "true"]],
    },
  }

  // Component mapping for react-markdown to match bubble styling (compact spacing)
  const markdownComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
    p: ({ children }) => <p className="my-0">{children}</p>,
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    ul: ({ children }) => <ul className="ml-4 list-disc space-y-0">{children}</ul>,
    ol: ({ children }) => <ol className="ml-4 list-decimal space-y-0">{children}</ol>,
    li: ({ children }) => <li className="ml-2 leading-tight [&>p]:my-0 [&+li]:mt-0.5">{children}</li>,
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:opacity-80"
      >
        {children}
      </a>
    ),
    code: ({ children, className, ...props }) => {
      // Inline code has no className, code blocks have className (language-xxx)
      const isInline = !className
      return isInline ? (
        <code className="rounded bg-muted/50 px-1 py-0.5 text-xs font-mono" {...props}>
          {children}
        </code>
      ) : (
        <code className="block rounded bg-muted/50 p-2 text-xs font-mono overflow-x-auto" {...props}>
          {children}
        </code>
      )
    },
    pre: ({ children }) => (
      <pre className="overflow-x-auto rounded bg-muted/50 p-2">
        {children}
      </pre>
    ),
    // Handle HTML mark tags for search highlighting
    mark: ({ children, ...props }: React.ComponentPropsWithoutRef<"mark">) => {
      // Check if this is a search highlight by examining the node prop (set by rehype-raw)
      const node = "node" in props && props.node && typeof props.node === "object"
        ? (props.node as { properties?: Record<string, unknown> })
        : undefined
      const isSearchHighlight =
        node?.properties?.["data-search-highlight"] === "true" ||
        node?.properties?.["data-search-highlight"] === true
      if (isSearchHighlight) {
        return (
          <mark className="bg-yellow-400/80 text-foreground rounded px-0.5 font-medium">
            {children}
          </mark>
        )
      }
      return <mark>{children}</mark>
    },
  }

  return (
    <div
      className={`chat-message flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] sm:max-w-[75%] lg:max-w-[65%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted text-foreground rounded-bl-md"
        } ${isError ? "border-2 border-destructive" : ""}`}
        >
        <div className="chat-bubble-content text-sm leading-tight whitespace-pre-wrap break-words">
          {contentToRender && (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
              components={markdownComponents}
            >
              {contentToRender}
            </ReactMarkdown>
          )}
        </div>

        {/* Error state with retry */}
        {isError && onRetry && (
          <div className="mt-3 pt-2 border-t border-current/10">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs">{message.errorMessage || "Erro ao enviar"}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRetry(message.id)}
                className="h-6 px-2 text-xs"
              >
                <RefreshCcw className="h-3 w-3 mr-1" />
                Tentar novamente
              </Button>
            </div>
          </div>
        )}

        {/* Sending state */}
        {isSending && (
          <div className="mt-2 flex items-center gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-current/50 animate-pulse" />
            <span className="text-[10px] opacity-70">Enviando...</span>
          </div>
        )}

        {/* Timestamp */}
        {!isSending && (
          <p
            className={`mt-1 text-[10px] ${
              isUser ? "text-primary-foreground/60" : "text-muted-foreground"
            }`}
          >
            {message.timestamp.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>
    </div>
  )
})
