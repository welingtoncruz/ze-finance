/**
 * API types and mappers for backend integration.
 * Maps between backend API shapes and frontend UI types.
 */
import type { Transaction, TransactionType, UserProfile } from "../types"

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

export interface ApiTransactionUpdate {
  amount?: number
  type?: "INCOME" | "EXPENSE"
  category?: string
  description?: string | null
  occurred_at?: string | null // ISO 8601 datetime string
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

export interface ApiUserProfileResponse {
  id: string
  email: string
  full_name: string | null
  monthly_budget: number
}

export interface ApiUserProfileUpdate {
  full_name?: string | null
  monthly_budget?: number
}

// Chat API Types
export interface ApiChatRequest {
  text: string
  content_type: "text"
  conversation_id?: string
}

export interface ApiChatMessage {
  id: string
  conversation_id: string
  role: "assistant" | "user"
  content: string
  content_type: string
  created_at: string
}

export interface ApiTransactionCreatedData {
  id: string
  amount: number
  type: "INCOME" | "EXPENSE"
  category: string
  description?: string | null
  occurred_at?: string | null
}

// UI Event Types
export interface ApiChatUiEvent {
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

export interface ApiChatAssistantMeta {
  ui_events: ApiChatUiEvent[]
  did_create_transaction: boolean
  created_transaction_id?: string | null
  insight_tags: string[]
}

export interface ApiChatMessageResponse {
  message: ApiChatMessage
  meta: ApiChatAssistantMeta
}

export interface ApiChatResponse {
  responseText: string
  transactionCreated: boolean
  data?: ApiTransactionCreatedData | null
  conversationId?: string
  uiEvents?: ApiChatUiEvent[] // UI events from metadata
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

export function mapUiTransactionToApiUpdate(
  updated: Transaction,
  original?: Transaction
): ApiTransactionUpdate {
  const update: ApiTransactionUpdate = {}
  
  // If original is provided, only send changed fields
  if (original) {
    if (updated.amount !== original.amount) {
      update.amount = updated.amount
    }
    if (updated.type !== original.type) {
      update.type = updated.type.toUpperCase() as "INCOME" | "EXPENSE"
    }
    if (updated.category !== original.category) {
      update.category = updated.category
    }
    if (updated.description !== original.description) {
      update.description = updated.description || null
    }
    if (updated.date !== original.date) {
      update.occurred_at = updated.date ? new Date(updated.date).toISOString() : null
    }
  } else {
    // No original, send all editable fields
    update.amount = updated.amount
    update.type = updated.type.toUpperCase() as "INCOME" | "EXPENSE"
    update.category = updated.category
    update.description = updated.description || null
    update.occurred_at = updated.date ? new Date(updated.date).toISOString() : null
  }
  
  return update
}

export function mapApiUserProfileToUi(apiProfile: ApiUserProfileResponse): UserProfile {
  return {
    id: apiProfile.id,
    name: apiProfile.full_name || "User",
    monthlyBudget: Number(apiProfile.monthly_budget),
    // Keep frontend-only fields with sensible defaults for now
    savingsGoal: 10000,
    streak: 0,
    totalSaved: 0,
  }
}

export function mapUiUserProfileToApi(profile: UserProfile): ApiUserProfileUpdate {
  return {
    full_name: profile.name || null,
    monthly_budget: profile.monthlyBudget,
  }
}
