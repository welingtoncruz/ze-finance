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

