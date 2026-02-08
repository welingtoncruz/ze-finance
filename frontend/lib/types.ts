export type TransactionType = "income" | "expense"

export interface Transaction {
  id: string
  amount: number
  type: TransactionType
  category: string
  date: string
  description?: string
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  status?: "sending" | "sent" | "error"
  kind?: "text" | "transaction_confirmation" | "ui_event"
  meta?: {
    transactionCreated?: boolean
    data?: {
      id: string
      amount: number
      type: "income" | "expense"
      category: string
      description?: string | null
      occurred_at?: string | null
    }
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
        deleted_transaction_id?: string
        amount?: number
        category?: string
      } | null
    }
  }
  errorCode?: string
  errorMessage?: string
  action?: {
    type: "add_transaction" | "show_insights" | "show_history"
    data?: Partial<Transaction>
  }
}

export interface UserProfile {
  name: string
  monthlyBudget: number
  savingsGoal: number
  streak: number
  totalSaved: number
}

