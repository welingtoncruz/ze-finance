"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { TransactionsScreen } from "@/components/transactions/TransactionsScreen"
import { SwipeDrawer } from "@/components/overlay/SwipeDrawer"
import { QuickAddTransaction } from "@/components/transactions/QuickAddTransaction"
import { EditTransactionDrawer } from "@/components/transactions/EditTransactionDrawer"
import { useAuth } from "@/context/AuthContext"
import api from "@/lib/api"
import type { ApiTransactionResponse, ApiUserProfileResponse } from "@/lib/types/api"
import {
  mapApiTransactionToUi,
  mapUiTransactionToApiCreate,
  mapUiTransactionToApiUpdate,
  mapApiUserProfileToUi,
} from "@/lib/types/api"
import type { Transaction, UserProfile } from "@/lib/types"
import { toast } from "sonner"
import { getUserFriendlyApiError } from "@/lib/errors/apiErrorMapper"

function TransactionsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isHydrated } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
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
      void loadData()
    }
  }, [isAuthenticated])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [profileRes, transactionsRes] = await Promise.all([
        api.get<ApiUserProfileResponse>("/user/profile"),
        api.get<ApiTransactionResponse[]>("/transactions?limit=50"),
      ])

      const mappedProfile = mapApiUserProfileToUi(profileRes.data)
      setUserProfile(mappedProfile)
      if (typeof window !== "undefined") {
        localStorage.setItem("zefa_profile", JSON.stringify(mappedProfile))
      }

      const mappedTransactions = transactionsRes.data.map(mapApiTransactionToUi)
      setTransactions(mappedTransactions)
    } catch (error) {
      console.error("Failed to load data:", error)
      toast.error("Falha ao carregar transações")

      if (typeof window !== "undefined") {
        const savedProfile = localStorage.getItem("zefa_profile")
        if (savedProfile) {
          setUserProfile(JSON.parse(savedProfile))
        }
      }
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
      setTransactions((prev) => prev.filter((t) => t.id !== id))
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
    try {
      // Find original transaction for comparison
      const originalTransaction = transactions.find((t) => t.id === updatedTransaction.id)
      
      // Update UI immediately (optimistic update)
      setTransactions((prev) =>
        prev.map((t) => (t.id === updatedTransaction.id ? updatedTransaction : t))
      )
      
      // Prepare update payload
      const updatePayload = mapUiTransactionToApiUpdate(updatedTransaction, originalTransaction)
      
      // Attempt backend sync
      try {
        const response = await api.patch<ApiTransactionResponse>(
          `/transactions/${updatedTransaction.id}`,
          updatePayload
        )
        const syncedTransaction = mapApiTransactionToUi(response.data)
        
        // Update with server response
        setTransactions((prev) =>
          prev.map((t) => (t.id === syncedTransaction.id ? syncedTransaction : t))
        )
        
        // Clear local pending edit if exists
        if (typeof window !== "undefined") {
          const localEdits = JSON.parse(
            localStorage.getItem("zefa_local_edits_v2") || "{}"
          )
          delete localEdits[updatedTransaction.id]
          localStorage.setItem("zefa_local_edits_v2", JSON.stringify(localEdits))
        }
        
        toast.success("Transação atualizada com sucesso")
        setIsEditDrawerOpen(false)
        setSelectedTransaction(null)
      } catch (syncError: any) {
        // Sync failed - persist locally as pending
        if (typeof window !== "undefined") {
          const localEdits = JSON.parse(
            localStorage.getItem("zefa_local_edits_v2") || "{}"
          )
          localEdits[updatedTransaction.id] = {
            transaction: updatedTransaction,
            updatedAt: new Date().toISOString(),
            syncStatus: syncError.response?.status === 404 ? "failed" : "pending",
          }
          localStorage.setItem("zefa_local_edits_v2", JSON.stringify(localEdits))
        }
        
        // Show appropriate message
        if (syncError.response?.status === 404) {
          toast.error("Transação não encontrada. A edição foi removida.")
          // Remove from UI if transaction was deleted
          setTransactions((prev) => prev.filter((t) => t.id !== updatedTransaction.id))
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

  // Load and sync local pending edits on mount
  useEffect(() => {
    if (typeof window !== "undefined" && transactions.length > 0) {
      const localEdits = JSON.parse(
        localStorage.getItem("zefa_local_edits_v2") || "{}"
      )
      
      if (Object.keys(localEdits).length > 0) {
        // Apply local edits to UI
        setTransactions((prev) =>
          prev.map((t) => {
            const edit = localEdits[t.id]
            return edit ? { ...t, ...edit.transaction } : t
          })
        )
        
        // Attempt to sync pending edits in background
        Object.entries(localEdits).forEach(async ([txId, edit]: [string, any]) => {
          if (edit.syncStatus === "pending") {
            try {
              const updatePayload = mapUiTransactionToApiUpdate(edit.transaction)
              const response = await api.patch<ApiTransactionResponse>(
                `/transactions/${txId}`,
                updatePayload
              )
              const syncedTransaction = mapApiTransactionToUi(response.data)
              
              // Update UI with synced data
              setTransactions((prev) =>
                prev.map((t) => (t.id === syncedTransaction.id ? syncedTransaction : t))
              )
              
              // Remove from local storage
              const updatedEdits = { ...localEdits }
              delete updatedEdits[txId]
              localStorage.setItem("zefa_local_edits_v2", JSON.stringify(updatedEdits))
            } catch (error: any) {
              // If 404, transaction was deleted - remove local edit
              if (error.response?.status === 404) {
                const updatedEdits = { ...localEdits }
                delete updatedEdits[txId]
                localStorage.setItem("zefa_local_edits_v2", JSON.stringify(updatedEdits))
                setTransactions((prev) => prev.filter((t) => t.id !== txId))
              }
              // Otherwise, keep as pending for retry later
            }
          }
        })
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

  const defaultProfile: UserProfile =
    userProfile || {
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
