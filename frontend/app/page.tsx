"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { DashboardScreen } from "@/components/dashboard/DashboardScreen"
import { useAuth } from "@/context/AuthContext"
import { useUserProfileQuery, useTransactionsQuery, useDashboardSummaryQuery } from "@/lib/queries"

export default function HomePage() {
  const router = useRouter()
  const { isAuthenticated, isHydrated } = useAuth()

  const profileQuery = useUserProfileQuery(Boolean(isAuthenticated))
  const transactionsQuery = useTransactionsQuery(Boolean(isAuthenticated))
  const summaryQuery = useDashboardSummaryQuery(Boolean(isAuthenticated))

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push("/login")
    }
  }, [isHydrated, isAuthenticated, router])

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

  const userProfile = profileQuery.data
  const transactions = transactionsQuery.data ?? []
  const dashboardSummary = summaryQuery.data ?? null

  const hasAnyCachedData = userProfile != null || transactions.length > 0 || dashboardSummary != null
  const isInitialLoading = profileQuery.isLoading && !userProfile

  if (isInitialLoading && !hasAnyCachedData) {
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

  const fallbackProfile = userProfile ?? {
    name: "User",
    monthlyBudget: 5000,
    savingsGoal: 10000,
    streak: 0,
    totalSaved: 0,
  }

  if (!userProfile && profileQuery.isError) {
    return (
      <AppShell userProfile={fallbackProfile}>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">Falha ao carregar perfil. Tente novamente.</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell userProfile={fallbackProfile}>
      <DashboardScreen
        transactions={transactions}
        userProfile={fallbackProfile}
        dashboardSummary={dashboardSummary}
        onViewHistory={() => router.push("/transactions")}
      />
    </AppShell>
  )
}
