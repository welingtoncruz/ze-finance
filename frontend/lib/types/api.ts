/**
 * API types and mappers for backend integration.
 * Maps between backend API shapes and frontend UI types.
 */
import type { Transaction, TransactionType } from "../types"

// Backend API DTOs
export interface ApiToken {
  access_token: string
  token_type: string
}

export interface ApiUserCreate {
  email: string
  password: string
}

export interface ApiTransactionCreate {
  amount: number
  type: "INCOME" | "EXPENSE"
  category: string
  description?: string
  occurred_at?: string // ISO 8601 datetime string
}

export interface ApiTransactionResponse {
  id: string
  amount: number
  type: "INCOME" | "EXPENSE"
  category: string
  description?: string | null
  occurred_at: string // ISO 8601 datetime string
  created_at: string // ISO 8601 datetime string
}

export interface ApiCategoryMetric {
  name: string
  value: number
}

export interface ApiDashboardSummary {
  total_balance: number
  total_income: number
  total_expense: number
  by_category: ApiCategoryMetric[]
}

// Mappers: Backend API -> Frontend UI
export function mapApiTransactionToUi(apiTx: ApiTransactionResponse): Transaction {
  return {
    id: apiTx.id,
    amount: Number(apiTx.amount),
    type: apiTx.type.toLowerCase() as TransactionType,
    category: apiTx.category,
    date: new Date(apiTx.occurred_at).toISOString().split("T")[0], // Extract YYYY-MM-DD
    description: apiTx.description || undefined,
  }
}

// Mappers: Frontend UI -> Backend API
export function mapUiTransactionToApiCreate(
  uiTx: Omit<Transaction, "id">
): ApiTransactionCreate {
  return {
    amount: uiTx.amount,
    type: uiTx.type.toUpperCase() as "INCOME" | "EXPENSE",
    category: uiTx.category,
    description: uiTx.description,
    occurred_at: uiTx.date ? new Date(uiTx.date).toISOString() : undefined,
  }
}
