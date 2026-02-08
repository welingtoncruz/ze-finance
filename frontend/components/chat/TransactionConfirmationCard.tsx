"use client"

import { memo } from "react"
import { CheckCircle2, Trash2 } from "lucide-react"
import type { ChatMessage } from "@/lib/types"

interface TransactionConfirmationCardProps {
  uiEvent: NonNullable<ChatMessage["meta"]>["uiEvent"]
}

export const TransactionConfirmationCard = memo(function TransactionConfirmationCard({
  uiEvent,
}: TransactionConfirmationCardProps) {
  if (!uiEvent) {
    return null
  }

  // Handle delete events (info_card)
  if (uiEvent.type === "info_card" && uiEvent.data?.deleted_transaction_id) {
    const deletedData = uiEvent.data
    return (
      <div className="chat-message flex justify-start">
        <div className="w-full max-w-[85%] rounded-xl bg-muted/50 border border-border p-2.5 sm:p-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
              <Trash2 className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-foreground leading-tight truncate">
                {uiEvent.title}
              </p>
              {uiEvent.subtitle && (
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                  {uiEvent.subtitle}
                </p>
              )}
            </div>
            {deletedData.category && (
              <div className="flex items-center gap-2 shrink-0 pl-2">
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">
                    {deletedData.category}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Handle create/update events (success_card with transaction)
  if (uiEvent.type === "success_card" && uiEvent.data?.transaction) {
    const transaction = uiEvent.data.transaction
    const isIncome = transaction.type === "INCOME"
    const formattedAmount = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(transaction.amount)

    return (
      <div className="chat-message flex justify-start">
        <div className="w-full max-w-[85%] rounded-xl bg-muted/50 border border-success/20 p-2.5 sm:p-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl ${
                isIncome ? "bg-success/15" : "bg-muted"
              }`}
            >
              <CheckCircle2
                className={`h-4 w-4 sm:h-4.5 sm:w-4.5 ${
                  isIncome ? "text-success-foreground" : "text-muted-foreground"
                }`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-foreground leading-tight truncate">
                {uiEvent.title}
              </p>
              {uiEvent.subtitle && (
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                  {uiEvent.subtitle}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 pl-2">
              <div className="text-right">
                <p
                  className={`text-xs sm:text-sm font-bold tabular-nums whitespace-nowrap ${
                    isIncome ? "text-success-foreground" : "text-foreground"
                  }`}
                >
                  {isIncome ? "+" : "-"}{formattedAmount}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {transaction.category}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Fallback: render generic card for other event types
  return (
    <div className="chat-message flex justify-start">
      <div className="w-full max-w-[85%] rounded-xl bg-muted/50 border border-border p-2.5 sm:p-3">
        <div className="flex items-center gap-2.5">
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-semibold text-foreground leading-tight truncate">
              {uiEvent.title}
            </p>
            {uiEvent.subtitle && (
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                {uiEvent.subtitle}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})
