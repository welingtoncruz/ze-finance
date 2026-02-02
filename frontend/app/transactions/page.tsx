"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { TransactionsScreen } from "@/components/transactions/TransactionsScreen"
import { SwipeDrawer } from "@/components/overlay/SwipeDrawer"
import { QuickAddTransaction } from "@/components/transactions/QuickAddTransaction"
import { EditTransactionDrawer } from "@/components/transactions/EditTransactionDrawer"
import { useAuth } from "@/context/AuthContext"
import api from "@/lib/api"
import type { ApiTransactionResponse } from "@/lib/types/api"
import { mapApiTransactionToUi, mapUiTransactionToApiCreate } from "@/lib/types/api"
import type { Transaction, UserProfile } from "@/lib/types"
import { toast } from "sonner"

export default function TransactionsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isHydrated } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push("/login")
    }
  }, [isHydrated, isAuthenticated, router])

  useEffect(() => {
    if (searchParams.get("add") === "true") {
      setIsDrawerOpen(true)
    }
  }, [searchParams])

  useEffect(() => {
    if (isAuthenticated) {
      loadTransactions()
    }
  }, [isAuthenticated])

  const loadTransactions = async () => {
    try {
      setIsLoading(true)
      const response = await api.get<ApiTransactionResponse[]>("/transactions?limit=50")
      const mappedTransactions = response.data.map(mapApiTransactionToUi)
      setTransactions(mappedTransactions)
    } catch (error) {
      console.error("Failed to load transactions:", error)
      toast.error("Failed to load transactions")
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddTransaction = async (transaction: Omit<Transaction, "id">) => {
    try {
      const apiData = mapUiTransactionToApiCreate(transaction)
      const response = await api.post<ApiTransactionResponse>("/transactions", apiData)
      const newTransaction = mapApiTransactionToUi(response.data)
      setTransactions((prev) => [newTransaction, ...prev])
      setIsDrawerOpen(false)
      toast.success("Transaction added successfully")
    } catch (error) {
      console.error("Failed to add transaction:", error)
      toast.error("Failed to add transaction")
      throw error
    }
  }

  const handleDeleteTransaction = async (id: string) => {
    try {
      await api.delete(`/transactions/${id}`)
      setTransactions((prev) => prev.filter((t) => t.id !== id))
      toast.success("Transaction deleted")
    } catch (error) {
      console.error("Failed to delete transaction:", error)
      toast.error("Failed to delete transaction")
    }
  }

  const handleEditTransaction = (transaction: Transaction) => {
    setSelectedTransaction(transaction)
    setIsEditDrawerOpen(true)
  }

  const handleSaveEdit = async (updatedTransaction: Transaction) => {
    try {
      // Local-only edit (backend update endpoint not available yet)
      setTransactions((prev) =>
        prev.map((t) => (t.id === updatedTransaction.id ? updatedTransaction : t))
      )
      
      // Persist to localStorage to avoid losing edits on refresh
      if (typeof window !== "undefined") {
        const localEdits = JSON.parse(
          localStorage.getItem("zefa_local_edits") || "{}"
        )
        localEdits[updatedTransaction.id] = updatedTransaction
        localStorage.setItem("zefa_local_edits", JSON.stringify(localEdits))
      }

      toast.success("Edição salva localmente. Sincronização em breve.")
      setIsEditDrawerOpen(false)
      setSelectedTransaction(null)
    } catch (error) {
      console.error("Failed to save edit:", error)
      toast.error("Falha ao salvar edição")
    }
  }

  // Load local edits on mount
  useEffect(() => {
    if (typeof window !== "undefined" && transactions.length > 0) {
      const localEdits = JSON.parse(
        localStorage.getItem("zefa_local_edits") || "{}"
      )
      if (Object.keys(localEdits).length > 0) {
        setTransactions((prev) =>
          prev.map((t) => (localEdits[t.id] ? { ...t, ...localEdits[t.id] } : t))
        )
      }
    }
  }, [transactions.length])

  if (!isHydrated || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background bg-mesh-gradient flex items-center justify-center">
        <div className="relative">
          <div className="h-16 w-16 rounded-2xl bg-primary/20 animate-pulse" />
          <div className="absolute inset-0 rounded-2xl bg-primary/10 animate-ping" />
        </div>
      </div>
    )
  }

  const defaultProfile: UserProfile = {
    name: "User",
    monthlyBudget: 5000,
    savingsGoal: 10000,
    streak: 1,
    totalSaved: 0,
  }

  return (
    <AppShell userProfile={defaultProfile}>
      <TransactionsScreen
        transactions={transactions}
        isLoading={isLoading}
        onAddTransaction={() => setIsDrawerOpen(true)}
        onEditTransaction={handleEditTransaction}
        onDeleteTransaction={handleDeleteTransaction}
      />
      <SwipeDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Nova Transação"
      >
        <QuickAddTransaction
          onAdd={handleAddTransaction}
          onClose={() => setIsDrawerOpen(false)}
        />
      </SwipeDrawer>
      <EditTransactionDrawer
        transaction={selectedTransaction}
        isOpen={isEditDrawerOpen}
        onClose={() => {
          setIsEditDrawerOpen(false)
          setSelectedTransaction(null)
        }}
        onSave={handleSaveEdit}
      />
    </AppShell>
  )
}
