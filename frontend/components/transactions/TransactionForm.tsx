"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, TrendingUp, TrendingDown } from "lucide-react"
import type { Transaction, TransactionType } from "@/lib/types"
import { CategoryPicker } from "./CategoryPicker"
import { getCategoriesByType, resolveCategoryValue, isPredefinedCategory } from "@/lib/transactions/categories"

interface TransactionFormProps {
  mode: "create" | "edit"
  initial?: Partial<Transaction>
  onSubmit: (data: Omit<Transaction, "id"> | Transaction) => Promise<void> | void
  onCancel?: () => void
}

export function TransactionForm({
  mode,
  initial,
  onSubmit,
  onCancel,
}: TransactionFormProps) {
  const [amount, setAmount] = useState(
    initial?.amount?.toString() || ""
  )
  const [type, setType] = useState<TransactionType>(
    initial?.type || "expense"
  )
  // Normalize initial category: resolve to canonical value if possible, otherwise keep raw string
  const initialCategory = initial?.category || ""
  const normalizedInitialCategory = resolveCategoryValue(initialCategory) || initialCategory
  const [category, setCategory] = useState(normalizedInitialCategory)
  const [date, setDate] = useState(
    initial?.date || new Date().toISOString().split("T")[0]
  )
  const [description, setDescription] = useState(initial?.description || "")
  const [isLoading, setIsLoading] = useState(false)

  // Reset category when type changes ONLY if it's a predefined category that's invalid for the new type
  // Custom categories should be preserved
  useEffect(() => {
    if (category) {
      const resolvedValue = resolveCategoryValue(category)
      
      // If it resolves to a canonical value, check if it's valid for current type
      if (resolvedValue) {
        const categories = getCategoriesByType(type)
        const isValid = categories.some((cat) => cat.value === resolvedValue)
        if (!isValid) {
          // Only clear if it's a predefined category that's invalid for this type
          setCategory("")
        }
      }
      // If it doesn't resolve (custom category), keep it - don't clear
    }
  }, [type, category])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || !category) return

    setIsLoading(true)
    try {
      const transactionData = {
        amount: parseFloat(amount),
        type,
        category,
        date,
        description: description || undefined,
      }

      if (mode === "edit" && initial?.id) {
        await onSubmit({ ...transactionData, id: initial.id } as Transaction)
      } else {
        await onSubmit(transactionData)
      }
    } catch (error) {
      // Error handling is done by parent
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col min-h-full">
      <div className="flex-1 overflow-y-auto space-y-5 -mx-4 px-4 pb-4">
      {/* Type Toggle */}
      <div className="flex gap-2 rounded-xl bg-muted p-1">
        <button
          type="button"
          onClick={() => {
            setType("expense")
            // Only reset category if it's a predefined category that's not valid for the new type
            if (category) {
              const resolvedValue = resolveCategoryValue(category)
              if (resolvedValue) {
                // It's a predefined category - check if valid for expense
                const categories = getCategoriesByType("expense")
                const isValid = categories.some((cat) => cat.value === resolvedValue)
                if (!isValid) {
                  setCategory("")
                }
              }
              // If custom category, keep it
            }
          }}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 font-medium transition-all ${
            type === "expense"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground"
          }`}
        >
          <TrendingDown className="h-4 w-4" />
          Despesa
        </button>
        <button
          type="button"
          onClick={() => {
            setType("income")
            // Only reset category if it's a predefined category that's not valid for the new type
            if (category) {
              const resolvedValue = resolveCategoryValue(category)
              if (resolvedValue) {
                // It's a predefined category - check if valid for income
                const categories = getCategoriesByType("income")
                const isValid = categories.some((cat) => cat.value === resolvedValue)
                if (!isValid) {
                  setCategory("")
                }
              }
              // If custom category, keep it
            }
          }}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 font-medium transition-all ${
            type === "income"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground"
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          Receita
        </button>
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <Label htmlFor="amount">Valor</Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          className="h-12"
          data-testid="tx-amount"
        />
      </div>

      {/* Category Picker */}
      <div className="space-y-2">
        <Label>Categoria</Label>
        <CategoryPicker
          value={category}
          onChange={setCategory}
          type={type}
          variant="regular"
        />
        {!category && (
          <p className="text-xs text-muted-foreground">
            Selecione uma categoria
          </p>
        )}
      </div>

      {/* Date */}
      <div className="space-y-2">
        <Label htmlFor="date">Data</Label>
        <Input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="h-12"
          data-testid="tx-date"
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Descrição (opcional)</Label>
        <Input
          id="description"
          type="text"
          placeholder="Adicione uma nota..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="h-12"
          data-testid="tx-description"
        />
      </div>
      </div>
      {/* Action Buttons - Fixed at bottom */}
      <div className="flex gap-2 pt-4 mt-auto border-t border-border shrink-0 bg-card sticky bottom-0 -mx-4 px-4 pb-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-12"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          className={onCancel ? "flex-1 h-12" : "w-full h-12"}
          disabled={isLoading || !amount || !category}
          data-testid="tx-submit"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {mode === "edit" ? "Salvando..." : "Adicionando..."}
            </>
          ) : (
            mode === "edit" ? "Salvar" : "Adicionar"
          )}
        </Button>
      </div>
    </form>
  )
}
