export type TransactionType = "income" | "expense"

export interface Transaction {
  id: string
  amount: number
  type: TransactionType
  category: string
  date: string
  description?: string
}

export type ViewType = "auth" | "onboarding" | "dashboard" | "add" | "transactions" | "insights" | "chat"

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
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

export interface InsightData {
  type: "warning" | "success" | "tip"
  title: string
  message: string
  icon: string
}
