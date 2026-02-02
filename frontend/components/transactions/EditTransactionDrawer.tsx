"use client"

import { SwipeDrawer } from "@/components/overlay/SwipeDrawer"
import { TransactionForm } from "./TransactionForm"
import type { Transaction } from "@/lib/types"

interface EditTransactionDrawerProps {
  transaction: Transaction | null
  isOpen: boolean
  onClose: () => void
  onSave: (transaction: Transaction) => Promise<void> | void
}

export function EditTransactionDrawer({
  transaction,
  isOpen,
  onClose,
  onSave,
}: EditTransactionDrawerProps) {
  if (!transaction) return null

  const handleSave = async (data: Transaction) => {
    await onSave(data)
    onClose()
  }

  return (
    <SwipeDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Editar Transação"
    >
      <TransactionForm
        mode="edit"
        initial={transaction}
        onSubmit={handleSave}
        onCancel={onClose}
      />
    </SwipeDrawer>
  )
}
