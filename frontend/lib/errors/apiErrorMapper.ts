import axios, { AxiosError } from "axios"

export type ApiErrorContext = "auth" | "transaction" | "chat" | "generic"

function isAxiosError(error: unknown): error is AxiosError {
  return axios.isAxiosError(error)
}

export function getUserFriendlyApiError(
  error: unknown,
  context: ApiErrorContext = "generic"
): string {
  // Network or unknown error (no response)
  if (isAxiosError(error) && !error.response) {
    // Timeout hint
    if (error.code === "ECONNABORTED") {
      return "Tempo de resposta excedido. Tente novamente."
    }
    return "Erro de conexão. Verifique sua internet."
  }

  if (isAxiosError(error) && error.response) {
    const status = error.response.status
    const data: any = error.response.data ?? {}
    const backendCode: string | undefined = typeof data.code === "string" ? data.code : undefined
    const backendDetail: string | undefined =
      typeof data.detail === "string" ? data.detail : undefined

    // Authentication and authorization
    if (status === 401) {
      if (context === "auth") {
        return "E-mail ou senha inválidos. Tente novamente."
      }
      return "Sua sessão expirou. Faça login novamente."
    }

    if (status === 403) {
      return "Você não tem permissão para realizar esta ação."
    }

    // Validation and client-side errors
    if (status >= 400 && status < 500) {
      if (context === "auth") {
        return "Não foi possível concluir o acesso. Verifique os dados e tente novamente."
      }
      if (context === "transaction") {
        return "Não foi possível concluir a operação. Verifique os dados e tente novamente."
      }
      if (context === "chat") {
        return "Não foi possível enviar sua mensagem. Verifique os dados e tente novamente."
      }
      return "Não foi possível concluir sua ação. Verifique os dados e tente novamente."
    }

    // Server-side or gateway errors
    if (status >= 500) {
      if (context === "chat") {
        // Backend may return sanitized AI errors (e.g., 502 for AI issues)
        return "Algo deu errado ao processar sua mensagem. Tente novamente mais tarde."
      }

      if (context === "transaction") {
        return "Algo deu errado ao processar a transação. Tente novamente mais tarde."
      }

      return "Algo deu errado no servidor. Tente novamente mais tarde."
    }
  }

  // Fallback for non-Axios or unexpected shapes
  return "Não foi possível completar a ação. Tente novamente."
}

