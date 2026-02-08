/**
 * Chat service: API normalization layer for chat endpoints.
 * Handles backend format (POST /chat/messages) returning envelope with message and metadata.
 */
import api from "@/lib/api"
import axios, { type AxiosError } from "axios"
import type {
  ApiChatRequest,
  ApiChatMessageResponse,
  ApiChatResponse,
  ApiTransactionCreatedData,
} from "@/lib/types/api"

const CHAT_TIMEOUT_MS = 30000 // 30 seconds

/**
 * Send a chat message to the backend and return normalized response.
 * 
 * @param input - Chat request with message text and optional conversation ID
 * @returns Normalized chat response
 * @throws Error on network failure, timeout, or API error
 */
export async function sendChatMessage(
  input: { message: string; conversationId?: string }
): Promise<ApiChatResponse> {
  try {
    const requestPayload: ApiChatRequest = {
      text: input.message,
      content_type: "text",
      ...(input.conversationId && { conversation_id: input.conversationId }),
    }

    console.log("[Chat Service] Sending message:", {
      text: input.message,
      conversationId: input.conversationId,
      payload: requestPayload,
    })

    const response = await api.post<ApiChatMessageResponse>(
      "/chat/messages",
      requestPayload,
      {
        timeout: CHAT_TIMEOUT_MS,
      }
    )

    console.log("[Chat Service] Response received:", response.data)

    const responseData = response.data
    const apiMessage = responseData.message
    const meta = responseData.meta

    // Extract transaction data from UI events if available
    let transactionData: ApiTransactionCreatedData | null = null
    if (meta.did_create_transaction && meta.ui_events.length > 0) {
      const successEvent = meta.ui_events.find((e) => e.type === "success_card")
      if (successEvent?.data?.transaction) {
        const tx = successEvent.data.transaction
        transactionData = {
          id: tx.id,
          amount: tx.amount,
          type: tx.type,
          category: tx.category,
          description: tx.description || null,
          occurred_at: tx.occurred_at || null,
        }
      }
    }

    // Normalize response
    const normalized: ApiChatResponse = {
      responseText: apiMessage.content,
      transactionCreated: meta.did_create_transaction,
      data: transactionData,
      conversationId: apiMessage.conversation_id,
      uiEvents: meta.ui_events,
    }

    return normalized
  } catch (error: unknown) {
    // Log error details for debugging
    console.error("[Chat Service] Error sending message:", error)
    
    // Check for timeout errors (both axios and plain objects)
    // This must be checked before axios.isAxiosError() for mocked errors
    if (error && typeof error === "object") {
      const errorObj = error as Record<string, unknown>
      if (
        "code" in errorObj &&
        (errorObj.code === "ECONNABORTED" || errorObj.code === "ETIMEDOUT")
      ) {
        throw new Error("TIMEOUT")
      }
    }

    // Check if it's an Axios error
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError
      console.error("[Chat Service] Axios error details:", {
        message: axiosError.message,
        code: axiosError.code,
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        data: axiosError.response?.data,
        config: {
          url: axiosError.config?.url,
          method: axiosError.config?.method,
          baseURL: axiosError.config?.baseURL,
        },
      })

      // Handle timeout (already checked above, but keep for completeness)
      if (axiosError.code === "ECONNABORTED" || axiosError.code === "ETIMEDOUT") {
        throw new Error("TIMEOUT")
      }

      // Handle HTTP errors with response
      if (axiosError.response) {
        const status = axiosError.response.status
        if (status === 401) {
          // JWT expired - interceptor will handle redirect
          throw new Error("UNAUTHORIZED")
        }
        if (status >= 500) {
          throw new Error("SERVER_ERROR")
        }
        if (status >= 400) {
          throw new Error("CLIENT_ERROR")
        }
      }

      // Handle network errors (no response received)
      if (!axiosError.response && axiosError.request) {
        throw new Error("NETWORK_ERROR")
      }
    }

    // Handle plain objects with response property (mocked errors in tests)
    // This must be checked before generic message checks
    if (error && typeof error === "object") {
      const errorObj = error as Record<string, unknown>
      if (
        "response" in errorObj &&
        errorObj.response &&
        typeof errorObj.response === "object"
      ) {
        const response = errorObj.response as Record<string, unknown>
        if ("status" in response && typeof response.status === "number") {
          const status = response.status
          if (status === 401) {
            throw new Error("UNAUTHORIZED")
          }
          if (status >= 500) {
            throw new Error("SERVER_ERROR")
          }
          if (status >= 400) {
            throw new Error("CLIENT_ERROR")
          }
        }
      }
    }

    // Handle generic network errors
    if (
      error &&
      typeof error === "object" &&
      "message" in error &&
      typeof error.message === "string"
    ) {
      const errorMessage = error.message
      if (
        errorMessage.includes("Network Error") ||
        errorMessage.includes("ERR_NETWORK") ||
        errorMessage.includes("ERR_INTERNET_DISCONNECTED") ||
        errorMessage.includes("ERR_CONNECTION_REFUSED") ||
        errorMessage.includes("Failed to fetch")
      ) {
        throw new Error("NETWORK_ERROR")
      }
    }

    console.error("[Chat Service] Unknown error type:", error)
    throw new Error("UNKNOWN_ERROR")
  }
}

