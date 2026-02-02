"use client"

import type { Transaction, TransactionType } from "@/lib/types"
import { TransactionForm } from "./TransactionForm"

interface QuickAddTransactionProps {
  onAdd: (transaction: Omit<Transaction, "id">) => Promise<void>
  onClose: () => void
  initialType?: TransactionType
}

export function QuickAddTransaction({
  onAdd,
  onClose,
  initialType,
}: QuickAddTransactionProps) {
  return (
    <TransactionForm
      mode="create"
      initial={initialType ? { type: initialType } : undefined}
      onSubmit={onAdd}
      onCancel={onClose}
    />
  )
}
