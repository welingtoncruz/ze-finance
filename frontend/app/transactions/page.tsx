"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { AppShell } from "@/components/layout/AppShell"
import { TransactionsScreen } from "@/components/transactions/TransactionsScreen"
import { SwipeDrawer } from "@/components/overlay/SwipeDrawer"
import { QuickAddTransaction } from "@/components/transactions/QuickAddTransaction"
import { EditTransactionDrawer } from "@/components/transactions/EditTransactionDrawer"
import { useAuth } from "@/context/AuthContext"
import { useUserProfileQuery, useTransactionsQuery } from "@/lib/queries"
import { queryKeys } from "@/lib/queries"
import api from "@/lib/api"
import type { ApiTransactionResponse } from "@/lib/types/api"
import {
  mapApiTransactionToUi,
  mapUiTransactionToApiCreate,
  mapUiTransactionToApiUpdate,
} from "@/lib/types/api"
import type { Transaction, UserProfile } from "@/lib/types"
import { toast } from "sonner"
import { getUserFriendlyApiError } from "@/lib/errors/apiErrorMapper"

function TransactionsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { isAuthenticated, isHydrated } = useAuth()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)

  const profileQuery = useUserProfileQuery(Boolean(isAuthenticated))
  const transactionsQuery = useTransactionsQuery(Boolean(isAuthenticated))

  const userProfile = profileQuery.data
  const transactions = transactionsQuery.data ?? []
  const hasCachedData = transactions.length > 0 || userProfile != null
  const isLoading = transactionsQuery.isLoading && !hasCachedData

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

  const invalidateTransactions = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.transactions })
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary })
  }

  const handleAddTransaction = async (transaction: Omit<Transaction, "id">) => {
    try {
      const apiData = mapUiTransactionToApiCreate(transaction)
      const response = await api.post<ApiTransactionResponse>("/transactions", apiData)
      const newTransaction = mapApiTransactionToUi(response.data)
      queryClient.setQueryData(queryKeys.transactions, (old: Transaction[] | undefined) =>
        old ? [newTransaction, ...old] : [newTransaction]
      )
      invalidateTransactions()
      setIsDrawerOpen(false)
      toast.success("Transação adicionada com sucesso")
    } catch (error) {
      console.error("Failed to add transaction:", error)
      toast.error(getUserFriendlyApiError(error, "transaction"))
      throw error
    }
  }

  const handleDeleteTransaction = async (id: string) => {
    try {
      await api.delete(`/transactions/${id}`)
      queryClient.setQueryData(queryKeys.transactions, (old: Transaction[] | undefined) =>
        old ? old.filter((t) => t.id !== id) : []
      )
      invalidateTransactions()
      toast.success("Transação excluída")
    } catch (error) {
      console.error("Failed to delete transaction:", error)
      toast.error(getUserFriendlyApiError(error, "transaction"))
    }
  }

  const handleEditTransaction = (transaction: Transaction) => {
    setSelectedTransaction(transaction)
    setIsEditDrawerOpen(true)
  }

  const handleSaveEdit = async (updatedTransaction: Transaction) => {
    const currentTransactions = queryClient.getQueryData<Transaction[]>(queryKeys.transactions) ?? []
    const originalTransaction = currentTransactions.find((t) => t.id === updatedTransaction.id)

    try {
      queryClient.setQueryData(
        queryKeys.transactions,
        currentTransactions.map((t) =>
          t.id === updatedTransaction.id ? updatedTransaction : t
        )
      )

      const updatePayload = mapUiTransactionToApiUpdate(updatedTransaction, originalTransaction)

      try {
        const response = await api.patch<ApiTransactionResponse>(
          `/transactions/${updatedTransaction.id}`,
          updatePayload
        )
        const syncedTransaction = mapApiTransactionToUi(response.data)

        queryClient.setQueryData(queryKeys.transactions, (old: Transaction[] | undefined) =>
          old ? old.map((t) => (t.id === syncedTransaction.id ? syncedTransaction : t)) : []
        )
        invalidateTransactions()

        if (typeof window !== "undefined") {
          const localEdits = JSON.parse(localStorage.getItem("zefa_local_edits_v2") || "{}")
          delete localEdits[updatedTransaction.id]
          localStorage.setItem("zefa_local_edits_v2", JSON.stringify(localEdits))
        }

        toast.success("Transação atualizada com sucesso")
        setIsEditDrawerOpen(false)
        setSelectedTransaction(null)
      } catch (syncError: unknown) {
        const err = syncError as { response?: { status?: number } }
        if (typeof window !== "undefined") {
          const localEdits = JSON.parse(localStorage.getItem("zefa_local_edits_v2") || "{}")
          localEdits[updatedTransaction.id] = {
            transaction: updatedTransaction,
            updatedAt: new Date().toISOString(),
            syncStatus: err.response?.status === 404 ? "failed" : "pending",
          }
          localStorage.setItem("zefa_local_edits_v2", JSON.stringify(localEdits))
        }

        if (err.response?.status === 404) {
          toast.error("Transação não encontrada. A edição foi removida.")
          queryClient.setQueryData(queryKeys.transactions, (old: Transaction[] | undefined) =>
            old ? old.filter((t) => t.id !== updatedTransaction.id) : []
          )
        } else {
          toast.warning("Edição salva localmente. Sincronização pendente.")
        }

        setIsEditDrawerOpen(false)
        setSelectedTransaction(null)
      }
    } catch (error) {
      console.error("Failed to save edit:", error)
      toast.error("Falha ao salvar edição")
    }
  }

  useEffect(() => {
    if (typeof window === "undefined" || transactions.length === 0) return

    const localEdits = JSON.parse(localStorage.getItem("zefa_local_edits_v2") || "{}")
    if (Object.keys(localEdits).length === 0) return

    const merged = transactions.map((t) => {
      const edit = localEdits[t.id] as { transaction?: Transaction } | undefined
      return edit?.transaction ? { ...t, ...edit.transaction } : t
    })
    queryClient.setQueryData(queryKeys.transactions, merged)

    Object.entries(localEdits).forEach(async ([txId, edit]: [string, unknown]) => {
      const e = edit as { syncStatus?: string; transaction?: Transaction }
      if (e.syncStatus !== "pending") return

      try {
        const original = transactions.find((t) => t.id === txId)
        const updatePayload = mapUiTransactionToApiUpdate(e.transaction!, original)
        const response = await api.patch<ApiTransactionResponse>(`/transactions/${txId}`, updatePayload)
        const syncedTransaction = mapApiTransactionToUi(response.data)

        queryClient.setQueryData(queryKeys.transactions, (old: Transaction[] | undefined) =>
          old ? old.map((t) => (t.id === syncedTransaction.id ? syncedTransaction : t)) : []
        )
        invalidateTransactions()

        const updatedEdits = { ...localEdits }
        delete updatedEdits[txId]
        localStorage.setItem("zefa_local_edits_v2", JSON.stringify(updatedEdits))
      } catch (error: unknown) {
        const err = error as { response?: { status?: number } }
        if (err.response?.status === 404) {
          const updatedEdits = { ...localEdits }
          delete updatedEdits[txId]
          localStorage.setItem("zefa_local_edits_v2", JSON.stringify(updatedEdits))
          queryClient.setQueryData(queryKeys.transactions, (old: Transaction[] | undefined) =>
            old ? old.filter((t) => t.id !== txId) : []
          )
        }
      }
    })
  }, [transactions.length, queryClient])

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

  const defaultProfile: UserProfile =
    userProfile ?? {
      name: "User",
      monthlyBudget: 5000,
      savingsGoal: 10000,
      streak: 0,
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

export default function TransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background bg-mesh-gradient flex items-center justify-center">
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl bg-primary/20 animate-pulse" />
          </div>
        </div>
      }
    >
      <TransactionsPageContent />
    </Suspense>
  )
}
