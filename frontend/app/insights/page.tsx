"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { useAuth } from "@/context/AuthContext"
import { InsightsScreen } from "@/components/insights/InsightsScreen"
import { ThemeToggle } from "@/components/theme-toggle"
import { BarChart3, Sparkles } from "lucide-react"
import api from "@/lib/api"
import type { ApiTransactionResponse, ApiUserProfileResponse } from "@/lib/types/api"
import { mapApiTransactionToUi, mapApiUserProfileToUi } from "@/lib/types/api"
import type { Transaction, UserProfile } from "@/lib/types"

export default function InsightsPage() {
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

      if (typeof window !== "undefined") {
        const savedProfile = localStorage.getItem("zefa_profile")
        if (savedProfile) {
          setUserProfile(JSON.parse(savedProfile))
        } else {
          setUserProfile({
            name: "User",
            monthlyBudget: 5000,
            savingsGoal: 10000,
            streak: 0,
            totalSaved: 0,
          })
        }
      }
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
    streak: 0,
    totalSaved: 0,
  }

  return (
    <AppShell userProfile={defaultProfile}>
      <div className="flex min-h-screen flex-col pb-28 lg:pb-8 theme-transition bg-mesh-gradient">
        {/* Mobile Header */}
        <header className="sticky top-0 z-10 gradient-header px-3 py-4 sm:px-6 sm:py-5 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15 backdrop-blur-sm">
                <BarChart3 className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-primary-foreground tracking-tight truncate">
                  Insights
                </h1>
              </div>
            </div>
            <ThemeToggle variant="header" />
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden lg:block sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Insights Financeiros</h1>
              <p className="text-sm text-muted-foreground">Acompanhe seu progresso e padrões de gastos</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-accent" />
              <span>Análise com IA</span>
            </div>
          </div>
        </header>
        
        <InsightsScreen 
          transactions={transactions} 
          userProfile={defaultProfile}
          isLoading={isLoading}
        />
      </div>
    </AppShell>
  )
}
