"use client"

import React from "react"
import { useState } from "react"
import {
  Trash2,
  Pencil,
  CircleDot,
} from "lucide-react"
import type { Transaction } from "@/lib/types"
import { getCategoryByValue } from "@/lib/transactions/categories"

interface TransactionItemProps {
  transaction: Transaction
  onDelete?: (id: string) => void
  onClick?: (transaction: Transaction) => void
  showDesktopActions?: boolean
}

export function TransactionItem({
  transaction,
  onDelete,
  onClick,
  showDesktopActions = false,
}: TransactionItemProps) {
  const [swipeX, setSwipeX] = useState(0)
  const [startX, setStartX] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const categoryDef = getCategoryByValue(transaction.category)
  const Icon = categoryDef?.icon || CircleDot
  const isIncome = transaction.type === "income"

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const dateOnly = dateStr.split("T")[0]
    const todayOnly = today.toISOString().split("T")[0]
    const yesterdayOnly = yesterday.toISOString().split("T")[0]

    if (dateOnly === todayOnly) {
      return "Hoje"
    } else if (dateOnly === yesterdayOnly) {
      return "Ontem"
    }
    return date.toLocaleDateString("pt-BR", { month: "short", day: "numeric" })
  }

  const handleClick = () => {
    if (!isSwiping && onClick) {
      onClick(transaction)
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX)
    setIsSwiping(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return
    const currentX = e.touches[0].clientX
    const diff = startX - currentX
    if (diff > 0) {
      setSwipeX(Math.min(diff, 80))
    }
  }

  const handleTouchEnd = () => {
    setIsSwiping(false)
    if (swipeX > 60 && onDelete) {
      onDelete(transaction.id)
    }
    setSwipeX(0)
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Delete action background */}
      {onDelete && (
        <div
          className="absolute inset-y-0 right-0 flex w-20 items-center justify-center bg-destructive rounded-r-xl"
          style={{ opacity: swipeX / 80 }}
        >
          <Trash2 className="h-5 w-5 text-destructive-foreground" />
        </div>
      )}

      {/* Main item */}
      <div
        className="relative flex items-center gap-2.5 sm:gap-3 rounded-xl bg-background p-2.5 sm:p-3 transition-all duration-200 hover:bg-muted/50 cursor-pointer active:scale-[0.99]"
        style={{ transform: `translateX(-${swipeX}px)` }}
        onTouchStart={onDelete ? handleTouchStart : undefined}
        onTouchMove={onDelete ? handleTouchMove : undefined}
        onTouchEnd={onDelete ? handleTouchEnd : undefined}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-200 ${
            isIncome ? "bg-success/15" : "bg-muted"
          }`}
        >
          <Icon
            className={`h-4 w-4 sm:h-5 sm:w-5 ${isIncome ? "text-success-foreground" : "text-muted-foreground"}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-[13px] sm:text-sm font-semibold text-foreground leading-tight">
            {categoryDef?.label || transaction.category}
          </p>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
            {formatDate(transaction.date)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 pl-2">
          <div className="text-right">
            <p
              className={`text-[13px] sm:text-sm font-bold tabular-nums whitespace-nowrap ${
                isIncome ? "text-success-foreground" : "text-foreground"
              }`}
            >
              {isIncome ? "+" : "-"}{formatCurrency(transaction.amount)}
            </p>
          </div>
          {/* Desktop hover actions */}
          {showDesktopActions && (isHovered || isSwiping) && (
            <div className="hidden lg:flex items-center gap-1 ml-2">
              {onClick && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onClick(transaction)
                  }}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  aria-label="Editar transação"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(transaction.id)
                  }}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label="Excluir transação"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
