"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { ZefaChatScreen } from "@/components/chat/ZefaChatScreen"
import api from "@/lib/api"
import type { ApiTransactionResponse } from "@/lib/types/api"
import { mapApiTransactionToUi } from "@/lib/types/api"
import type { Transaction, UserProfile } from "@/lib/types"

export default function ChatPage() {
  const router = useRouter()
  const { isAuthenticated, isHydrated } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push("/login")
    }
  }, [isHydrated, isAuthenticated, router])

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      
      // Load user profile from localStorage
      if (typeof window !== "undefined") {
        const savedProfile = localStorage.getItem("zefa_user_profile")
        if (savedProfile) {
          setUserProfile(JSON.parse(savedProfile))
        } else {
          setUserProfile({
            name: "User",
            monthlyBudget: 5000,
            savingsGoal: 10000,
            streak: 1,
            totalSaved: 0,
          })
        }
      }

      // Load transactions
      const transactionsRes = await api.get<ApiTransactionResponse[]>("/transactions?limit=50")
      const mappedTransactions = transactionsRes.data.map(mapApiTransactionToUi)
      setTransactions(mappedTransactions)
    } catch (error) {
      console.error("Failed to load data:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      loadData()
    }
  }, [isAuthenticated, loadData])

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

  const defaultProfile: UserProfile = userProfile || {
    name: "User",
    monthlyBudget: 5000,
    savingsGoal: 10000,
    streak: 1,
    totalSaved: 0,
  }

  return (
    <div className="min-h-screen bg-background bg-mesh-gradient theme-transition">
      <ZefaChatScreen transactions={transactions} userProfile={defaultProfile} />
    </div>
  )
}
