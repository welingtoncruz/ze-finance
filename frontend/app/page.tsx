"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { DashboardScreen } from "@/components/dashboard/DashboardScreen"
import { useAuth } from "@/context/AuthContext"
import api from "@/lib/api"
import type { ApiDashboardSummary, ApiTransactionResponse } from "@/lib/types/api"
import { mapApiTransactionToUi } from "@/lib/types/api"
import type { Transaction, UserProfile } from "@/lib/types"

export default function HomePage() {
  const router = useRouter()
  const { isAuthenticated, isHydrated } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [dashboardSummary, setDashboardSummary] = useState<ApiDashboardSummary | null>(null)
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
      
      // Load user profile from localStorage (frontend-only for MVP)
      const savedProfile = localStorage.getItem("zefa_profile")
      if (savedProfile) {
        setUserProfile(JSON.parse(savedProfile))
      } else {
        // Default profile
        setUserProfile({
          name: "User",
          monthlyBudget: 5000,
          savingsGoal: 10000,
          streak: 1,
          totalSaved: 0,
        })
      }

      // Fetch transactions and dashboard summary in parallel
      const [transactionsRes, summaryRes] = await Promise.all([
        api.get<ApiTransactionResponse[]>("/transactions?limit=50"),
        api.get<ApiDashboardSummary>("/dashboard/summary"),
      ])

      const mappedTransactions = transactionsRes.data.map(mapApiTransactionToUi)
      setTransactions(mappedTransactions)
      setDashboardSummary(summaryRes.data)
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

  if (isLoading || !userProfile) {
    return (
      <AppShell>
        <div className="min-h-screen flex items-center justify-center">
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl bg-primary/20 animate-pulse" />
            <div className="absolute inset-0 rounded-2xl bg-primary/10 animate-ping" />
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell userProfile={userProfile}>
      <DashboardScreen
        transactions={transactions}
        userProfile={userProfile}
        dashboardSummary={dashboardSummary}
        onViewHistory={() => router.push("/transactions")}
      />
    </AppShell>
  )
}
